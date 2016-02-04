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
      res.send(userInfo).end();
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

app.get('/api/opinions/:ids', (req, res) => {
  const opinionIds = req.params.ids.split(',');

  log.info(opinionIds);

  db.getOpinions(opinionIds)
    .then(log.promise('opinions:'))
    .then(opinions => res.send(opinions).end());
});

app.get('/api/user/:userId/topic/:topicId/opinion', function(req, res) {
  const {userId, topicId} = req.params;

  db.getOrCreateOpinion(userId, topicId)
    .then(opinion => res.send(opinion).end());

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
