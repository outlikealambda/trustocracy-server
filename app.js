var
  express = require('express'),
  logger = require('morgan'),
  bodyParser = require('body-parser'),

  frontend = require('./frontend'),
  db = require('./graph');


var app = express();

// Configuration

app.set('port', process.env.PORT || 3714);

// from 2.0 example
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));

app.get('/public/*', function(req, res) {
  frontend.proxyGet(req.params['0']).pipe(res);
});

app.get('/api/user/:id', function(req, res) {
  res.set({ 'Content-Type': 'application/json' });

  db.getUserInfo(req.params.id).then(userInfo => {
    res.send(userInfo);
  }, error => {
    console.log(error);
    res.status(404).send('Unknown user');
  });
});

app.get('/api/user/:userId/topic/:topicId/opinions', function(req, res) {
  var {userId, topicId} = req.params;

  res.set({ 'Content-Type': 'application/json' });

  db.getNearestOpinions(userId, topicId).then(nearestOpinions => {
    res.send(nearestOpinions);
  });
});


// Start server
app.listen(app.get('port'), function() {
  console.log('Starting node');
});
