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

const answer = {

  create : (topicId, opinionId, userId, questionId, pickOne, assess) =>
    db.one(query.answer.create, {topicId, opinionId, userId, questionId, pickOne, assess}),

  update : (answerId, pickOne, assess) =>
    db.one(query.answer.update, {answerId, pickOne, assess})
      .then(() => answerId),

  remove : answerId =>
    db.any(query.answer.remove, {answerId}),

  byUser : (topicId, opinionId, userId) =>
    db.any(query.answer.byUser, {topicId, opinionId, userId})
      .then(humps.camelizeKeys)

};

module.exports = {
  answer,
  getQuestions,
  getPickOneQuestions
};
