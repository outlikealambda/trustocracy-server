const connectionString = 'postgres://trusto:@localhost/trusto';
const humps = require('humps');
const pgp = require('pg-promise')();
const db = pgp(connectionString);
const query = require('./query');
const knex = require('./rdb.js');

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

/**
 * Map of promptId => prompt
 */
const promptsMap = topicId =>
  knex.select('prompt.id', 'prompt.type', 'prompt.text', 'prompt.text_short', 'option.sort_order', 'option.text as option_text')
    .from('prompt')
    .innerJoin('option', 'prompt.id', 'option.prompt_id')
    .where('prompt.topic_id', topicId)
    .orderBy('prompt.id', 'option.sort_order')
    .then(humps.camelizeKeys)
    .then(records => records.reduce(
      (agg, record) => {
        const {id, type, text, textShort, sortOrder, optionText} = record;

        if (!agg[id]) {
          agg[id] = {
            id,
            type,
            text,
            textShort,
            options: []
          };
        }

        agg[id].options.push({ sortOrder, text: optionText });

        return agg;
      }, {}
    ));

const answer = {

  create: (topicId, opinionId, userId, questionId, picked, rated) =>
    db.one(query.answer.create, {topicId, opinionId, userId, questionId, picked, rated}),

  update: (answerId, picked, rated) =>
    db.one(query.answer.update, {answerId, picked, rated}),

  remove: answerId =>
    db.any(query.answer.remove, {answerId}),

  /**
   * Returns an object whose keys are opinionIds:
   *
   * {
   *   1: {
   *     id: 1,
   *     answers: [
   *       {
   *         promptId: 12,
   *         selected: 1
   *       },
   *       {
   *         promptId, 13,
   *         value: 0.23
   *       }
   *     ]
   *   },
   *   2: {
   *     id: 2,
   *     answers: [
   *       {
   *         promptId: 12,
   *         selected: 0
   *       },
   *       {
   *         promptId, 13,
   *         value: 0.76
   *       }
   *     ]
   *   },
   * }
   **/
  all: topicId =>
    knex.select('answer.opinion_id', 'answer.prompt_id', 'answer.value', 'answer.selected')
      .from('answer')
      .innerJoin('prompt', 'answer.prompt_id', 'prompt.id')
      .where('prompt.topic_id', topicId)
      .orderBy('answer.opinion_id')
      .orderBy('answer.prompt_id')
      .then(humps.camelizeKeys)
      .then(records => records.reduce((agg, record) => {
        const {opinionId, promptId, value, selected} = record;

        if (!agg[opinionId]) {
          agg[opinionId] = {
            id: opinionId,
            answers: []
          };
        }

        agg[opinionId].answers.push({
          promptId,
          value,
          selected
        });

        return agg;
      }, {}
    )),

  byUser: (topicId, opinionId, userId) =>
    db.any(query.answer.byUser, {topicId, opinionId, userId})
      .then(humps.camelizeKeys)

};

module.exports = {
  answer,
  promptsMap,
  getQuestions,
  getPickOneQuestions,
  getRateQuestionIds
};
