const rdb = require('./relational/relational.js');
const gdb = require('./graph/graph.js');

function opinions (topicId) {
  return Promise.all(
    [
      gdb.getOpinionsByTopic(topicId),
      rdb.answer.all(topicId)
    ])
    .then(([opinions, answers]) =>
      opinions.map(opinion => Object.assign(
          {},
          opinion,
          answers[opinion.id]
        )
      ))
    .then(Object.values);
}

module.exports = {
  opinions,
  gdb,
  rdb
};
