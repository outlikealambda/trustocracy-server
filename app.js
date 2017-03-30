'use strict';

const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const idGenerator = require('./db/graph/id-generator');
// const frontend = require('./frontend');
const gdb = require('./db/graph/graph');
const rdb = require('./db/relational/relational');
const log = require('./logger');

  // init first for env variables
const app = express();

const { fbDecodeAndValidate, fbGetMe } = require('./facebook');
const { fbSecret, trustoSecret, gaApiKey, saltOptions } = require(`./config-${app.get('env')}.json`);
const googleAuth = require('./googleAuth')(gaApiKey);
const trustoAuth = require('./trustoAuth')(trustoSecret, saltOptions);

// Configuration
app.set('port', process.env.PORT || 3714);

// from 2.0 example
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(cookieParser());

// ------------------------------
// OPEN ENDPOINTS (no-validation)
// ------------------------------

// returns a single opinion
app.get('/api/opinion/:opinionId', (req, res) => {
  const {opinionId} = req.params;
  log.info('opinion endpoint', opinionId);
  gdb.getOpinionById(opinionId)
    .then(opinion => res.send(opinion).end())
    .catch(err => {
      log.error('error getting opinion', opinionId, err);
      res.status(500).send('could not get opinion');
    });
});

app.get('/api/opinion/:opinionId/metrics', (req, res) => {
  rdb.getRateQuestionIds()
    .then(questionIds =>
      questionIds.map(questionId =>
        ({ questionId, rating: Math.random() * 100 })))
    .then(questions => res.send(questions).end())
    .catch(err => {
      log.info('error getting rate question metrics!', err);
      res.status(500).send('could not get rate question metrics');
    });
});

// takes a list of ids, and returns a list of opinions
app.get('/api/opinions/:ids', (req, res) => {
  const opinionIds = req.params.ids.split(',');

  log.info(opinionIds);

  gdb.getOpinionsByIds(opinionIds)
    .then(log.promise('opinions:'))
    .then(opinions => res.send(opinions).end());
});

// returns all opinions for a given :topicId
app.get('/api/topic/:topicId/opinions', (req, res) => {
  const {topicId} = req.params;
  gdb.getOpinionsByTopic(topicId)
    .then(opinions => res.send(opinions).end())
    .catch(err => {
      log.error('error getting opinions for topic', topicId, err);
      res.status(500).send('could not get opinions');
    });
});

// return basic info for :topicId
app.get('/api/topic/:topicId', (req, res) => {
  const {topicId} = req.params;
  gdb.getTopic(topicId)
    .then(topic => res.send(topic).end())
    .catch(err => {
      log.error('error getting topic', topicId, err);
      res.status(500).send('could not get topic');
    });
});

// return a list of all questions for a topic
app.get('/api/topic/:topicId/questions', (req, res) => {
  const {topicId} = req.params;

  rdb.getQuestions(topicId)
    .then(data => res.send(data).end());
});

// return a list of all topics
app.get('/api/topic', (req, res) => {
  gdb.getTopics()
    .then(topics => res.send(topics).end());
});

app.post('/api/signup', (req, res) => {
  const {name, email, password} = req.body;

  gdb.createUser(name, email, password)
    .then(user => gdb.getUserInfo(user.id))
    .then(userInfo => res.send(userInfo).end())
    .catch(err => {
      log.info('error signing up', err);
      res.status(500).send('sign up failed');
    });
});

// validates the user against the gdb
app.get('/api/login', (req, res) => {
  const authorization = req.headers.authorization || '';
  const [, basicAuth] = authorization.split('Basic ');
  const [userName, secret] = basicAuth ? Buffer.from(basicAuth, 'base64').toString('ascii').split(':') : ['', ''];

  if (!userName) {
    res.status(401).send('missing basic auth credentials').end();
    return;
  }

  trustoAuth.validateUser(userName, secret)
    .then(user => gdb.getUserInfo(user.id))
    .then(userInfo => saveUserAsCookie(res, userInfo).send(userInfo).end())
    .catch(() => {
      log.info('login error!');
      res.status(401).send('invalid credentials, please try again!').end();
    });
});

// checks if there is a valid jwt session with a user; returns the user
app.get('/api/checkUser', (req, res) => {
  trustoAuth.getUserId(req)
    .then(id => gdb.getUserInfo(id))
    .then(userInfo => res.send(userInfo).end())
    .catch(() => {
      res.status(401).send('please log in!').end();
    });
});

function saveUserAsCookie (res, userInfo) {
  log.info('user info', userInfo);
  return res.cookie('trustoToken', trustoAuth.createJwt(userInfo), { 'maxAge': 1000 * 60 * 60 });
}

// login with google authentication
// requires an idToken attached via headers.gasignedrequest
app.get('/api/gaUser', (req, res) => {
  const {gasignedrequest: idToken, gaaccesstoken: accessToken} = req.headers;

  googleAuth.asyncValidate(idToken, accessToken, (err, payload) => {
    if (err) {
      res.status(401).send(err).end();
      log.info('failed??');
      return;
    }

    const googleId = payload.sub;

    gdb.getUserByGoogleId(googleId)
      .then(user => {
        log.info('user', user);

        // if no existing user, create one
        // google ids are too long for neo as ints, so convert to a string
        return user.name ? user : gdb.createUserWithGoogleId(googleId, payload.name, payload.email);
      })
      .then(user => gdb.getUserInfo(user.id))
      .then(userInfo => saveUserAsCookie(res, userInfo).send(userInfo).end())
      .catch(err => {
        log.info('ga user fail', err);

        res.status(401).end(err);
      });
  });
});

// login with google authentication
// requires an idToken attached via headers.fbsignedrequest
app.get('/api/fbUser', (req, res) => {
  const [ errMsg, data ] = fbDecodeAndValidate(fbSecret, req.headers.fbsignedrequest);

  if (errMsg) {
    res.status(401).send(errMsg).end();
    return;
  }

  const fbUserId = data.user_id;

  gdb.getUserByFacebookId(fbUserId)
    .then(user => {
      if (user.name) {
        return user;
      }

      // if user not found, then send request to FB for info...
      return fbGetMe(req.headers.fbaccesstoken)
        .then(JSON.parse)
        .then(fbMe => gdb.createUserWithFacebookId(fbUserId, fbMe.name));
    })
    .then(user => gdb.getUserInfo(user.id))
    .then(userInfo => saveUserAsCookie(res, userInfo).send(userInfo).end())
    .catch(err => res.status(401).end(err));
});

// just so the catchall doesn't get it and fail
// if the elm server isn't running
app.get('/favicon.ico', (req, res) => {
  res.end();
});

// get user, emails and locations
app.get('/api/:userId', function (req, res) {
  const userId = req.params.userId;

  gdb.getUserInfoWithLocations(userId)
    .then(userInfo => {
      // log.info('app.js returned userInfo', userInfo);
      res.send(userInfo).end();
    })
    .catch(error => {
      log.info(error);
      res.status(404).end('Unknown user');
    });
});

// insecure user endpoint
app.get('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  gdb.getUserInfo(userId)
    .then(userInfo => res.send(userInfo).end())
    .catch(error => {
      log.info(error);
      res.status(404).end('Unknown user');
    });
});

// insecure connected opinions for a user/topic
app.get('/api/topic/:topicId/connected/:userId', (req, res) => {
  const { topicId, userId } = req.params;
  gdb.getConnectedOpinions(userId, topicId)
    .then(connectedOpinions =>
      res.set({ 'Content-Type': 'application/json' })
        .send(connectedOpinions)
        .end())
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

// insecure set target for a topic/user/target
app.get('/api/topic/:topicId/user/:userId/target/:targetId', (req, res) => {
  const { userId, targetId, topicId } = req.params;

  gdb.setTarget(userId, targetId, topicId)
    .then(() => {
      res.sendStatus(200);
    })
    .catch(err => {
      console.log(err);
      res.sendStatus(500);
    });
});

// ----------------
// CLOSED ENDPOINTS
// ----------------

app.use('/api/secure/*', trustoAuth.validateMiddleware);

// returns userInfo
// TODO: make sure that :id matches cookie Id
app.get('/api/secure/user', function (req, res) {
  const userId = req.userId;

  gdb.getUserInfo(userId)
    .then(userInfo => res.send(userInfo).end())
    .catch(error => {
      log.info(error);
      res.status(404).end('Unknown user');
    });
});

// returns the location assosciated with the logged in user id
// GET LOCATION
app.get('/api/secure/getLocation', (req, res) => {
  const userId = req.userId;
  log.info(userId);
  gdb.getLocationByUserId(userId)
    .then(location => {
      // log.info(location);
      res.send(location).end();
    });
    // .then((location) => log.info('app.js', location));
});

app.get('/api/user/:locationId', (req, res) => {
  const
    locationId = req.params.locationId;

  gdb.getUserByLocation(locationId)
    .then(user => {
      // log.info(user);
      res.send(user).end();
    });
});

// creates relationships between user and location components
// POST LOCATION
app.post('/api/secure/postLocation', (req, res) => {
  const {name, country, city, postal} = req.body;
  const userId = req.userId;
  // log.info('app.js post location', req.body);
  gdb.connectUserToLocation(userId, name, country, city, postal)
    .then(location => {
      // log.info('app.js post location after connect', location);
      res.send(location).end();
    })
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

// DELETE LOCATION
app.delete('/api/:locationId/deleteLocation', (req, res) => {
  const locationId = req.params.locationId;

  gdb.removeLocation(locationId)
    .then(() => res.send(locationId).end())
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

// UPDATE LOCATION
app.post('/api/:locationId/updateLocation', (req, res) => {
  const {name, country, city, postal} = req.body;
  const locationId = parseInt(req.params.locationId);

  // log.info('app.js pre', name, req.body);
  gdb.updateLocation(locationId, name, country, city, postal)
    .then(updateLocation => {
      // log.info('app.js post', updateLocation);
      res.send(updateLocation).end();
    })
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

app.get('/api/secure/gaContacts', (req, res) => {
  const userId = req.userId;
  const accessToken = req.headers.gaaccesstoken;

  googleAuth.retrieveContacts(accessToken)
    .then(contacts => contacts
        .map(contacts => contacts.emails)
        .reduce((accumulator, emails) => accumulator.concat(emails), []))
    .then(log.promise('map-reduced'))
    .then(emails => gdb.connectUserToEmails(userId, emails))
    .then(() => gdb.getUserInfo(userId))
    .then(userInfo => res.send(userInfo).end())
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

// returns connected opinions for a user/topic
app.get('/api/secure/topic/:topicId/connected', (req, res) => {
  const { topicId } = req.params;
  const userId = req.userId;
  gdb.getConnectedOpinions(userId, topicId)
    .then(connectedOpinions =>
      res.set({ 'Content-Type': 'application/json' })
        .send(connectedOpinions)
        .end())
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

// returns the opinion (if it exists) a :userId has written on :topicId
// TODO: make sure that :userId matches cookie Id
app.get('/api/secure/topic/:topicId/opinion', function (req, res) {
  const topicId = req.params.topicId;
  const userId = req.userId;

  gdb.getOpinionByUserTopic(userId, topicId)
    .then(log.promise('user opinion'))
    .then(opinion => {
      if (!opinion.id) {
        return gdb.getUser(userId)
          .then(user => {
            // attach self as author
            const author = Object.assign(
              {},
              user,
              {relationship: 'SELF'}
            );

            return Object.assign(
              {},
              opinion,
              {author}
            );
          });
      } else {
        return opinion;
      }
    })
    .then(opinion => res.send(opinion).end());
});

// save and publish an opinion for :topicId
app.post('/api/secure/topic/:topicId/opinion/publish', function (req, res) {
  const topicId = req.params.topicId;
  const userId = req.userId;
  const opinion = req.body;

  gdb.publishOpinion(userId, topicId, opinion)
    .then(published => res.send(published).end());
});

// save an opinion (but don't publish) for on :topicId
app.post('/api/secure/topic/:topicId/opinion/save', function (req, res) {
  const topicId = req.params.topicId;
  const userId = req.userId;
  const opinion = req.body;

  gdb.saveOpinion(userId, topicId, opinion)
    .then(saved => res.send(saved).end());
});

app.get('/api/secure/topic/:topicId/opinion/:opinionId/answer', (req, res) => {
  const {topicId, opinionId} = req.params;
  const userId = req.userId;

  rdb.answer.byUser(topicId, opinionId, userId)
    .then(data => res.send(data).end())
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

app.post('/api/secure/topic/:topicId/opinion/:opinionId/question/:questionId/answer', (req, res) => {
  const {topicId, opinionId, questionId} = req.params;
  const userId = req.userId;
  const {picked, rated} = req.body;

  rdb.answer.create(topicId, opinionId, userId, questionId, picked, rated)
    .then(answerId => res.send(answerId).end())
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

app.post('/api/secure/answer/:answerId', (req, res) => {
  const {answerId} = req.params;
  const {picked, rated} = req.body;

  rdb.answer.update(answerId, picked, rated)
    .then(answerId => res.send(answerId).end())
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

app.delete('/api/secure/answer/:answerId', (req, res) => {
  const {answerId} = req.params;

  rdb.answer.delete(answerId)
    .then(() => res.send('success!').end())
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

app.post('/api/secure/delegate', function (req, res) {
  const userId = req.userId;
  const delegate = req.body;

  gdb.delegate(userId, delegate)
    .then(d => res.send(d).end());
});

app.get('/api/secure/delegate/lookup', (req, res) => {
  const email = req.query.email;

  return gdb.getTrusteeByEmail(email)
    .then(trustee => {
      trustee ? res.send(trustee).end() : res.status(404).end();
    });
});

/*
app.get('/*', function (req, res) {
  frontend.proxyGet(req.params['0']).pipe(res);
});
*/

// Start server
idGenerator.init().then(() => {
  app.listen(app.get('port'), function () {
    log.info('Starting node');
  });
});
