// Requires basic Neo4j data -- specifically, Topic -> Opinion relationships
const graph = require('../../db/graph/graph.js');
const rdb = require('../../db/relational/rdb.js');
const log = require('../../logger.js');
const humps = require('humps');

for (let topicId = 0; topicId < 10; topicId++) {
  Promise.all(
    [
      graph.getOpinionIdsByTopic(topicId),
      getPrompts(topicId)
    ])
    .then(([opinionIds, prompts]) =>
      Promise.all(
        opinionIds
          .map(buildAnswersForOpinion(prompts))
          // Flatten [[answer][answer]] into [answer, answer]
          .reduce((agg, elem) => agg.concat(elem), [])
          .map(answer => humps.decamelizeKeys(answer))
          .map(saveAnswer)
      )
    )
    .then(log.promise('results'))
    .catch(e => console.error(e));
}

function saveAnswer (answer) {
  return rdb
    .insert(answer, 'id')
    .into('answer')
    .then(([id]) => id);
}

function buildAnswersForOpinion (prompts) {
  return opinionId =>
    prompts.map(({id: promptId, type, count}) => (
      {
        opinionId,
        promptId: promptId,
        selected: type === 'MULTIPLE_CHOICE' ? Math.floor(Math.random() * count) : null,
        value: type === 'SCALAR' ? Math.random() : null
      }
    ));
}

function getPrompts (topicId) {
  return rdb('prompt')
    .where('topic_id', topicId)
    .select('id', 'type')
    .map(({id, type}) => {
      console.log('prompt', id, type);

      if (type === 'SCALAR') {
        return {
          id,
          type
        };
      }

      return rdb('option')
        .where('prompt_id', id)
        .select('sort_order')
        .then(options => ({
          id,
          type,
          count: options.length
        }));
    });
}
