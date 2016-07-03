const
  join = require('bluebird').join,
  cq = require('./cypher-query'),
  log = require('./logger'),
  current = {
    opinion: 0,
    user: 0,
    topic: 0
  };

function init() {
  return join(getOpinionMax(), getUserMax(), getTopicMax())
    .then(log.promise('id generator initial values'));
}

function nextOpinionId() {
  return current.opinion += 1;
}

function nextUserId() {
  return current.user += 1;
}

function nextTopicId() {
  return current.topic += 1;
}

function createMaxValueQuery(nodeType, field) {
  return `MATCH (n:${nodeType})
          RETURN max(n.${field})`;
}

function getOpinionMax() {
  return cq.query(createMaxValueQuery('Opinion', 'id'))
    .then(extractMax)
    .then(maxVal => current.opinion = maxVal);
}

function getUserMax() {
  return cq.query(createMaxValueQuery('Person', 'id'))
    .then(extractMax)
    .then(maxVal => current.user = maxVal);
}

function getTopicMax() {
  return cq.query(createMaxValueQuery('Topic', 'id'))
    .then(extractMax)
    .then(maxVal => current.topic = maxVal);
}

function extractMax(neoData) {
  const [{data: [{row: [maxVal]}]}] = neoData.results;

  return maxVal;
}

module.exports = {
  init,
  nextOpinionId,
  nextUserId,
  nextTopicId
};
