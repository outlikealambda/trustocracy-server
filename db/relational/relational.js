const
  connectionString = 'postgres://trusto:@localhost/trusto',
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
    .any(query.pickQuestions, {topicId})
    .then(humps.camelizeKeys);
}

function getRateQuestionIds() {
  return db
    .any(query.rateQuestions)
    .then(humps.camelizeKeys)
    .then(questions => questions.map(q => q.id));
}

const answer = {

  create : (topicId, opinionId, userId, questionId, picked, rated) =>
    db.one(query.answer.create, {topicId, opinionId, userId, questionId, picked, rated}),

  update : (answerId, picked, rated) =>
    db.one(query.answer.update, {answerId, picked, rated}),

  remove : answerId =>
    db.any(query.answer.remove, {answerId}),

  byUser : (topicId, opinionId, userId) =>
    db.any(query.answer.byUser, {topicId, opinionId, userId})
      .then(humps.camelizeKeys)

};

module.exports = {
  answer,
  getQuestions,
  getPickOneQuestions,
  getRateQuestionIds
};
