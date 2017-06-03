const rdb = require('./relational/relational.js');
const gdb = require('./graph/graph.js');

function opinions (topicId) {
  return Promise.all(
    [
      gdb.getOpinionsByTopic(topicId),
      rdb.answer.all(topicId)
    ])
    .then(([opinions, answers]) => {
      // create object keyed by opinion id for easier lookup/insertion
      const keyedOpinions = opinions
        .map(addEmptyAnswers)
        .reduce((agg, elem) => {
          agg[elem.id] = elem;
          return agg;
        }, {});

      // push each answer to the appropriate opinion
      answers.forEach(answer => keyedOpinions[answer.opinionId].answers.push(answer));

      return Object.values(keyedOpinions);
    });
}

function addEmptyAnswers (opinion) {
  return Object.assign(
    {},
    opinion,
    { answers: [] }
  );
}

module.exports = {
  opinions
};
