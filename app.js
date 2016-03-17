'use strict';

var
  express = require('express'),
  logger = require('morgan'),
  bodyParser = require('body-parser'),

  idGenerator = require('./id-generator'),
  frontend = require('./frontend'),
  db = require('./graph'),
  log = require('./logger');


var app = express();

// Configuration
app.set('port', process.env.PORT || 3714);

// from 2.0 example
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));

// gets

app.get('/api/user/:id', function(req, res) {
  res.set({ 'Content-Type': 'application/json' });

  db.getUserInfo(req.params.id)
    .then(userInfo => {
      res.send(userInfo.user).end();
    }, error => {
      log.info(error);
      res.status(404).end('Unknown user');
    });
});

app.get('/api/user/:userId/topic/:topicId/opinions', function(req, res) {
  const {userId, topicId} = req.params;

  res.set({ 'Content-Type': 'application/json' });

  db.getNearestOpinions(userId, topicId)
    .then(nearest => res.send(nearest).end());
});

app.get('/api/opinion/:opinionId', (req, res) => {
  const {opinionId} = req.params;

  log.info('opinion endpoint', opinionId);

  db.getOpinionById(opinionId)
    .then(opinion => res.send(opinion).end());
});

app.get('/api/opinions/:ids', (req, res) => {
  const opinionIds = req.params.ids.split(',');

  log.info(opinionIds);

  db.getOpinionsByIds(opinionIds)
    .then(log.promise('opinions:'))
    .then(opinions => res.send(opinions).end());
});

app.get('/api/topic/:topicId/opinion', (req, res) => {
  const topicId = req.params.topicId;

  db.getOpinionsByTopic(topicId)
    .then(opinions => res.send(opinions).end());
});

app.get('/api/user/:userId/topic/:topicId/opinion', function(req, res) {
  const {userId, topicId} = req.params;

  db.getOpinionByUserTopic(userId, topicId)
    .then(opinion => res.send(opinion).end());
});

app.post('/api/user/:userId/topic/:topicId/opinion/publish', function(req, res) {
  const
    {userId, topicId} = req.params,
    opinion = req.body;

  db.publishOpinion(userId, topicId, opinion)
    .then(published => res.send(published).end());
});

// we can use this endpoint if we at some point want to distinguish between
// retrieving a published vs draft when retrieving via user + topic.
// otherwise, for now, the api/user/:userId/topic/:topicId/opinion endpoint
// retrieves the most recently edited -- either a draft or a published opinion
// app.get('/api/user/:userId/topic/:topicId/opinion/draft', function(req, res) {
//   const {userId, topicId} = req.params;
//
//   db.getOpinionByUserTopic(userId, topicId)
//     .then(opinion => res.send(opinion).end());
//
// });

app.post('/api/user/:userId/topic/:topicId/opinion/save', function(req, res) {
  const
    {userId, topicId} = req.params,
    opinion = req.body;

  log.info(opinion);

  db.saveOpinion(userId, topicId, opinion)
    .then(saved => res.send(saved).end());
});

app.get('/api/topic/:topicId', (req, res) => {
  const {topicId} = req.params;

  db.getTopic(topicId)
    .then(topic => res.send(topic).end());
});

app.get('/api/topic', (req, res) => {
  db.getTopics()
    .then(topics => res.send(topics).end());
});

app.get('/api/fbUser', (req, res) => {
  console.log(req.headers);
  res.json({
    name: 'ME',
    id: 5
  }).end();
});

// just so the catchall doesn't get it and fail
// if the elm server isn't running
app.get('/favicon.ico', (req, res) => {
  res.end();
});

app.get('/*', function(req, res) {
  frontend.proxyGet(req.params['0']).pipe(res);
});

// posts
app.post('/api/user/:userId/topic/:topicId/opinion', function(req, res) {
  const
    {userId, topicId} = req.params,
    opinion = req.body;

  log.info('opinion write params', {userId, topicId, opinion});
  res.set({ 'Content-Type': 'application/json' });

  db.publishOpinion(userId, topicId, opinion)
    .then(opinion => res.send(opinion).end());
});

// Start server
idGenerator.init().then(() => {
  app.listen(app.get('port'), function() {
    log.info('Starting node');
  });
});
