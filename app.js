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
  googleAuth = require('./googleAuth'),

  // init first for env variables
  app = express(),

  { fbDecodeAndValidate, fbGetMe } = require('./facebook'),
  { fbSecret, trustoSecret } = require(`./config-${app.get('env')}.json`),
  trustoAuth = require('./trustoAuth')(trustoSecret);


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


// validates the user against the db
app.get('/api/login', (req, res) => {
  // TODO: insert manual validation here
  const {name, secret} = req.headers;

  db.validateUser(name, secret)
    .then(user => db.getUserInfo(user.id))
    .then(userInfo => saveUserAsCookie(res, userInfo).send(userInfo).end())
    .catch(err => {
      log.info('err, login', err);
      res.status(401).send('please log in!').end();
    });

});

// checks if there is a valid jwt session with a user; returns the user
app.get('/api/checkUser', (req, res) => {
  trustoAuth.getUserId(req)
    .then(id => db.getUserInfo(id))
    .then(userInfo => res.send(userInfo).end())
    .catch(err => {
      log.info('err', err);
      res.status(401).send('please log in!').end();
    });
});

function saveUserAsCookie(res, userInfo) {
  return res.cookie('trustoToken', trustoAuth.createJwt(userInfo));
}

// login with google authentication
// requires an idToken attached via headers.gasignedrequest
app.get('/api/gaUser', (req, res) => {
  googleAuth.asyncValidate(req.headers.gasignedrequest, (err, payload) => {
    if (err) {
      res.status(401).send(err).end();
      return;
    }

    const googleId = payload.sub;

    db.getUserByGoogleId(googleId)
      .then(user => {

        // if no existing user, create one
        // google ids are too long for neo as ints, so convert to a string
        return user.name ? user : db.createUserWithGoogleId(googleId, payload.name);
      })
      .then(user => db.getUserInfo(user.id))
      .then(userInfo => saveUserAsCookie(res, userInfo).send(userInfo).end())
      .catch(err => res.status(401).end(err));
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


// ----------------
// CLOSED ENDPOINTS
// ----------------
// looks like they all start with api/user! rest success?


app.use('/api/secure/*', trustoAuth.validateJwt);

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

// returns the opinion (if it exists) a :userId has written on :topicId
// TODO: make sure that :userId matches cookie Id
app.get('/api/secure/topic/:topicId/opinion', function(req, res) {
  const
    topicId = req.params.topicId,
    userId = req.userId;

  db.getOpinionByUserTopic(userId, topicId)
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
