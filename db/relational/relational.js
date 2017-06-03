const connectionString = 'postgres://trusto:@localhost/trusto';
  // logger = require('../../logger'),
const humps = require('humps');
const pgp = require('pg-promise')();
const db = pgp(connectionString);
const query = require('./query');
const knex = require('./rdb.js');
const log = require('../../logger.js');

function getQuestions (topicId) {
  return db
    .any(query.questions, {topicId})
    .then(humps.camelizeKeys);
}

function getPickOneQuestions (topicId) {
  return db
    .any(query.pickQuestions, {topicId})
    .then(humps.camelizeKeys);
}

function getRateQuestionIds () {
  return db
    .any(query.rateQuestions)
    .then(humps.camelizeKeys)
    .then(questions => questions.map(q => q.id));
}

const answer = {

  create: (topicId, opinionId, userId, questionId, picked, rated) =>
    db.one(query.answer.create, {topicId, opinionId, userId, questionId, picked, rated}),

  update: (answerId, picked, rated) =>
    db.one(query.answer.update, {answerId, picked, rated}),

  remove: answerId =>
    db.any(query.answer.remove, {answerId}),

  all: topicId =>
    knex.select('answer.opinion_id', 'answer.prompt_id', 'answer.value', 'answer.selected')
      .from('answer')
      .innerJoin('prompt', 'answer.prompt_id', 'prompt.id')
      .where('prompt.topic_id', topicId)
      .orderBy('answer.opinion_id')
      .orderBy('answer.prompt_id')
      .then(humps.camelizeKeys),

  byUser: (topicId, opinionId, userId) =>
    db.any(query.answer.byUser, {topicId, opinionId, userId})
      .then(humps.camelizeKeys)

};

module.exports = {
  answer,
  getQuestions,
  getPickOneQuestions,
  getRateQuestionIds
};
