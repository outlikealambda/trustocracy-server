const join = require('bluebird').join;
const cq = require('./cypher-query');
const log = require('../../logger');
const current = {
  opinion: 0,
  draft: 0,
  user: 0,
  topic: 0,
  location: 0
};

function init () {
  return join(
      getOpinionMax(),
      getDraftMax(),
      getUserMax(),
      getTopicMax(),
      getLocationMax()
    )
    .then(log.promise('id generator initial values'));
}

function nextLocationId () {
  current.location += 1;
}

function nextOpinionId () {
  current.opinion += 1;
}

function nextDraftId () {
  current.draft += 1;
}

function nextUserId () {
  current.user += 1;
}

function nextTopicId () {
  current.topic += 1;
}

function createMaxValueQuery (nodeType, field) {
  return `MATCH (n:${nodeType})
          RETURN max(n.${field})`;
}

function getOpinionMax () {
  return cq.query(createMaxValueQuery('Opinion', 'id'))
    .then(extractMax)
    .then(maxVal => {
      current.opinion = maxVal;
      return;
    });
}

function getDraftMax () {
  return cq.query(createMaxValueQuery('Opinion', 'draftId'))
    .then(extractMax)
    .then(maxVal => {
      current.draft = maxVal;
      return;
    });
}

function getUserMax () {
  return cq.query(createMaxValueQuery('Person', 'id'))
    .then(extractMax)
    .then(maxVal => {
      current.user = maxVal;
      return;
    });
}

function getTopicMax () {
  return cq.query(createMaxValueQuery('Topic', 'id'))
    .then(extractMax)
    .then(maxVal => {
      current.topic = maxVal;
      return;
    });
}

function getLocationMax () {
  return cq.query(createMaxValueQuery('Location', 'id'))
    .then(extractMax)
    .then(maxVal => { current.location = maxVal; return; });
}

function extractMax (neoData) {
  const [{data: [{row: [maxVal]}]}] = neoData.results;

  return maxVal || 0;
}

module.exports = {
  init,
  nextLocationId,
  nextOpinionId,
  nextDraftId,
  nextUserId,
  nextTopicId
};
