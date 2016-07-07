const
  connectionString = 'postgres://wr:@localhost/trusto',
  // logger = require('../../logger'),
  humps = require('humps'),
  pgp = require('pg-promise')(),
  db = pgp(connectionString),
  query = require('./query');


function getQuestions(topicId) {
  return db
    .any(query.questions, {topicId})
    .then(humps.camelizeKeys);
}

function getPickOneQuestions(topicId) {
  return db
    .any(query.pickOneQuestions, {topicId})
    .then(humps.camelizeKeys);
}

module.exports = {
  getQuestions,
  getPickOneQuestions
};
