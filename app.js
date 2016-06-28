'use strict';

const
  express = require('express'),
  logger = require('morgan'),
  bodyParser = require('body-parser'),
  cookieParser = require('cookie-parser'),

  idGenerator = require('./id-generator'),
  frontend = require('./frontend'),
  db = require('./graph'),
  log = require('./logger'),

  // init first for env variables
  app = express(),

  { fbDecodeAndValidate, fbGetMe } = require('./facebook'),
  { fbSecret, trustoSecret, gaApiKey, saltOptions } = require(`./config-${app.get('env')}.json`),
  googleAuth = require('./googleAuth')(gaApiKey),
  trustoAuth = require('./trustoAuth')(trustoSecret, saltOptions);


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

  db.getOpinionById(opinionId)
    .then(opinion => res.send(opinion).end());
});

// takes a list of ids, and returns a list of opinions
app.get('/api/opinions/:ids', (req, res) => {
  const opinionIds = req.params.ids.split(',');

  log.info(opinionIds);

  db.getOpinionsByIds(opinionIds)
    .then(log.promise('opinions:'))
    .then(opinions => res.send(opinions).end());
});

// returns all opinions for a given :topicId
app.get('/api/topic/:topicId/opinion', (req, res) => {
  const topicId = req.params.topicId;

  db.getOpinionsByTopic(topicId)
    .then(opinions => res.send(opinions).end());
});

// return basic info for :topicId
app.get('/api/topic/:topicId', (req, res) => {
  const {topicId} = req.params;

  db.getTopic(topicId)
    .then(topic => res.send(topic).end());
});

// return a list of all topics
app.get('/api/topic', (req, res) => {
  db.getTopics()
    .then(topics => res.send(topics).end());
});

app.post('/api/signup', (req, res) => {
  const {name, email, password} = req.body;

  db.createUser(name, email, password)
    .then(user => db.getUserInfo(user.id))
    .then(userInfo => res.send(userInfo).end())
    .catch(err => {
      log.info('error signing up', err);
      res.status(500).send('sign up failed');
    });
});


// validates the user against the db
app.get('/api/login', (req, res) => {
  const
    authorization = req.headers.authorization || '',
    [, basicAuth]= authorization.split('Basic '),
    [userName, secret] = basicAuth ? Buffer.from(basicAuth, 'base64').toString('ascii').split(':') : ['', ''];

  if (!userName) {
    res.status(401).send('missing basic auth credentials').end();
    return;
  }

  trustoAuth.validateUser(userName, secret)
    .then(user => db.getUserInfo(user.id))
    .then(userInfo => saveUserAsCookie(res, userInfo).send(userInfo).end())
    .catch(() => {
      log.info('login error!');
      res.status(401).send('invalid credentials, please try again!').end();
    });

});

// checks if there is a valid jwt session with a user; returns the user
app.get('/api/checkUser', (req, res) => {
  trustoAuth.getUserId(req)
    .then(id => db.getUserInfo(id))
    .then(userInfo => res.send(userInfo).end())
    .catch(() => {
      res.status(401).send('please log in!').end();
    });
});

function saveUserAsCookie(res, userInfo) {
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

    db.getUserByGoogleId(googleId)
      .then(user => {
        log.info('user', user);

        // if no existing user, create one
        // google ids are too long for neo as ints, so convert to a string
        return user.name ? user : db.createUserWithGoogleId(googleId, payload.name, payload.email);
      })
      .then(user => db.getUserInfo(user.id))
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
  const [ errMsg, data ] =
    fbDecodeAndValidate(fbSecret, req.headers.fbsignedrequest);

  if (errMsg) {
    res.status(401).send(errMsg).end();
    return;
  }

  const fbUserId = data.user_id;

  db.getUserByFacebookId(fbUserId)
    .then(user => {
      if (user.name) {
        return user;
      }

      // if user not found, then send request to FB for info...
      return fbGetMe(req.headers.fbaccesstoken)
        .then(JSON.parse)
        .then(fbMe => db.createUserWithFacebookId(fbUserId, fbMe.name));
    })
    .then(user => db.getUserInfo(user.id))
    .then(userInfo => saveUserAsCookie(res, userInfo).send(userInfo).end())
    .catch(err => res.status(401).end(err));
});


// just so the catchall doesn't get it and fail
// if the elm server isn't running
app.get('/favicon.ico', (req, res) => {
  res.end();
});

//get user location and other shit
app.get('/api/:userId', function(req, res) {
  const
    userId = req.params.userId;

  db.getUserInfo2(userId)
    .then(userInfo => {
      log.info(userInfo);
      res.send(userInfo).end();
    })
    .catch(error => {
      log.info(error);
      res.status(404).end('Unknown user');
    });
});


// ----------------
// CLOSED ENDPOINTS
// ----------------


app.use('/api/secure/*', trustoAuth.validateMiddleware);

// returns userInfo
// TODO: make sure that :id matches cookie Id
app.get('/api/secure/user', function(req, res) {
  const userId = req.userId;

  db.getUserInfo(userId)
    .then(userInfo => res.send(userInfo).end())
    .catch(error => {
      log.info(error);
      res.status(404).end('Unknown user');
    });
});

//returns the location assosciated with the given user id
//GET LOCATION
app.get('/api/:userId/getLocation', (req,res) => {
  const
    userId = req.params.userId;
  log.info(userId);
  db.getLocationById(userId)
    .then(location => res.send(location).end());
});

//creates relationships between user and location components
//POST LOCATION
app.post('/api/:userId/postLocation', (req,res) => {
  const {locationName, country, city, postal} = req.body,
    userId = req.params.userId;

  db.connectUserToLocation(userId, locationName, country, city, postal)
    .then(() => res.send(req.body).end())
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

//DELETE LOCATION
app.delete('/api/:locationId/deleteLocation', (req,res) =>{
  const
    locationId = req.params.locationId;

  db.removeLocation(locationId)
    .then(() => res.send().end())
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

//UPDATE LOCATION
app.post('/api/:userId/:locationId/updateLocation', (req,res) =>{
  const {locationName, country, city, postal} = req.body,
    userId = req.params.userId,
    locationId = req.params.locationId;

  db.updateLocation(locationId, userId, locationName, country, city, postal)
    .then(() => res.send().end())
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

app.get('/api/secure/gaContacts', (req, res) => {
  const
    userId = req.userId,
    accessToken = req.headers.gaaccesstoken;

  googleAuth.retrieveContacts(accessToken)
    .then(contacts => contacts
        .map(contacts => contacts.emails)
        .reduce((accumulator, emails) => accumulator.concat(emails), []))
    .then(log.promise('map-reduced'))
    .then(emails => db.connectUserToEmails(userId, emails))
    .then(() => db.getUserInfo(userId))
    .then(userInfo => res.send(userInfo).end())
    .catch(error => {
      log.info(error);
      res.status(500).end('server error!');
    });
});

// returns connected opinions for a user/topic
// TODO: make sure that :userId matches cookie Id
app.get('/api/secure/topic/:topicId/connected', function(req, res) {
  const
    topicId = req.params.topicId,
    userId = req.userId;

  res.set({ 'Content-Type': 'application/json' });

  db.getNearestOpinions(userId, topicId)
    .then(nearest => res.send(nearest).end());
});


app.get('/api/secure/topic/:topicId/connected/v2', function(req, res) {
  const
    topicId = req.params.topicId,
    userId = req.userId;

  db.getConnectedOpinions(userId, topicId)
    .then(nearest => res.send(nearest).end());
});

// returns the opinion (if it exists) a :userId has written on :topicId
// TODO: make sure that :userId matches cookie Id
app.get('/api/secure/topic/:topicId/opinion', function(req, res) {
  const
    topicId = req.params.topicId,
    userId = req.userId;

  db.getOpinionByUserTopic(userId, topicId)
    .then(log.promise('user opinion'))
    .then(opinion => {
      if (opinion.id === -1) {
        return db.getUser(userId)
          .then(user => {
            const author = Object.assign(
              {},
              user,
              {relationship : 'SELF'}
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
app.post('/api/secure/topic/:topicId/opinion/publish', function(req, res) {
  const
    topicId = req.params.topicId,
    userId = req.userId,
    opinion = req.body;

  db.publishOpinion(userId, topicId, opinion)
    .then(published => res.send(published).end());
});

// save an opinion (but don't publish) for on :topicId
app.post('/api/secure/topic/:topicId/opinion/save', function(req, res) {
  const
    topicId = req.params.topicId,
    userId = req.userId,
    opinion = req.body;

  db.saveOpinion(userId, topicId, opinion)
    .then(saved => res.send(saved).end());
});

app.post('/api/secure/delegate', function(req, res) {
  const
    userId = req.userId,
    delegate = req.body;

  db.delegate(userId, delegate)
    .then(d => res.send(d).end());
});

app.get('/api/secure/delegate/lookup', (req, res) => {
  const email = req.query.email;

  return db.getTrusteeByEmail(email)
    .then(trustee => {
      trustee ? res.send(trustee).end() : res.status(404).end();
    });

});

app.get('/*', function(req, res) {
  frontend.proxyGet(req.params['0']).pipe(res);
});


// Start server
idGenerator.init().then(() => {
  app.listen(app.get('port'), function() {
    log.info('Starting node');
  });
});
