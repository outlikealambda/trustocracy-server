'use strict';

const
  {join} = require('bluebird'),
  cq = require('./cypher-query'),
  models = require('./models'),
  idGenerator = require('./id-generator'),
  log = require('./logger');


function getUserInfo(id) {
  return join(getUser(id), getUserNeighbors(id), combineUserAndNeighbors);
}

function getUser(id) {
  return cq.query(buildUserQuery(id)).then(transformUserData);
}

function getUserNeighbors(id) {
  return cq.query(buildNeighborsQuery(id)).then(transformNeighborsData);
}

function publishOpinion(userId, topicId, opinion) {

  // update/build the OPINES relationship with a timestamp
  return cq.query(buildMarkAsPublishedQuery(userId, topicId))
    // write the new vals
    .then(() => cq.queryWithParams(buildWriteOpinionQuery(opinion.id), opinion))
    .then(transformOpinion);
}

function getOpinionById(opinionId) {
  return cq.query(buildGetOpinionByIdQuery(opinionId))
    .then(transformOpinion);
}

function getOrCreateOpinion(userId, topicId) {
  return cq.query(buildGetOpinionQuery(userId, topicId))
    .then(transformOpinion)
    // if it doesn't exist, create it
    .then(opinion => opinion ? opinion : createOpinion(userId, topicId))
    // add in any missing fields.  lazy migrations could eventually run here
    .then(log.promise('post-creation'))
    .then(opinion => Object.assign({}, models.opinion, opinion));
}

function createOpinion(userId, topicId) {
  return cq.query(buildCreateOpinionQuery(userId, topicId, idGenerator.nextOpinionId()))
    .then(transformOpinion);
}

function getNearestOpinions(userId, topicId) {
  log.time('opinions');
  return cq.query(buildNearestOpinionsQuery(userId, topicId))
    .then(neoData => {
      log.timeEnd('opinions');
      return neoData;
    })
    .then(transformNearestOpinionsData);
}

function getOpinions(ids) {
  return cq.query(buildOpinionsQuery(ids))
    .then(transformOpinions);
}

function buildUserQuery(id) {
  return `MATCH (u:Person {id:${id}})
          RETURN u`;
}

function buildNeighborsQuery(id) {
  return `MATCH (u:Person {id:${id}})-[relationship]->(friend:Person)
          RETURN u, type(relationship) as r, friend`;
}

function buildNearestOpinionsQuery(userId, topicId) {
  return `MATCH (p:Person)-[:TRUSTS_EXPLICITLY|:TRUSTS]->(f:Person)-[rs:TRUSTS_EXPLICITLY|:TRUSTS*0..3]->(ff:Person)-[:OPINES]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
          WHERE p.id=${userId} AND t.id=${topicId}
          RETURN f, extract(r in rs | type(r)) as extracted, ff, o`;
}

function buildOpinionsQuery(ids) {
  const idList = ids.join();
  return `MATCH (o:Opinion)
          WHERE o.id IN [${idList}]
          RETURN o`;
}

function buildCreateOpinionQuery(userId, topicId, opinionId) {
  return `MATCH (u:Person), (t:Topic)
          WHERE u.id=${userId} AND t.id=${topicId}
          CREATE (o:Opinion { id: ${opinionId} }),
          (u)-[:THINKS]->(o)-[:ADDRESSES]->(t)
          RETURN o`;
}

function buildGetOpinionByIdQuery(opinionId) {
  return `MATCH (o:Opinion)
          WHERE o.id = ${opinionId}
          RETURN o`;
}

function buildGetOpinionQuery(userId, topicId) {
  return `MATCH (p:Person)-[:THINKS|:OPINES]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
          WHERE p.id = ${userId} AND t.id = ${topicId}
          RETURN o`;
}

function buildMarkAsPublishedQuery(userId, topicId) {
  return `MATCH (p:Person)-[:THINKS|:OPINES]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
          WHERE p.id = ${userId} AND t.id = ${topicId}
          MERGE (p)-[opines:OPINES]->(o)
          ON CREATE SET opines.created = timestamp(), opines.updated = timestamp()
          ON MATCH SET opines.updated = timestamp()
          RETURN opines`;
}

// props are passed in via queryWithParams 2nd arg
function buildWriteOpinionQuery(opinionId) {
  return `MATCH (o:Opinion)
          WHERE o.id = ${opinionId}
          SET o = { props }
          RETURN o`;
}

function combineUserAndNeighbors(user, neighbors) {
  return {
    user,
    neighbors
  };
}

const transformUserData = extractSingleResult;

const transformOpinion = extractSingleResult;

function extractSingleResult(neoData) {
  if (noResults(neoData)) {
    return null;
  }

  const [{data: [{row: [first]}]}] = neoData.results;

  return first;
}

function noResults(neoData) {
  const [result] = neoData.results;

  if (!result) {
    return true;
  }

  const {data: [firstRow]} = result;

  if (!firstRow) {
    return true;
  }

  // has results
  return false;
}

function transformNeighborsData(neoData) {
  // destructuring: node needs to run with --harmony_destructuring flag
  const [{data}] = neoData.results;

  return data.map(datum => {
    const [, rel, friend] = datum.row;

    return {
      rel,
      friend
    };
  });
}

function transformOpinions(neoData) {
  const [{data}] = neoData.results;

  return data.map(datum => {
    const [opinion] = datum.row;

    return opinion;
  });
}

function transformNearestOpinionsData(neoData) {
  const
    [{data}] = neoData.results,
    scoredPaths = data.map(datum => {
      const
        [friend, path, opiner, opinion] = datum.row,
        score = scorePath(path);

      return {
        friend,
        path,
        opiner,
        opinion: opinion.id,
        score,
        key: friend.id + ':' + opiner.id
      };
    });

  return {
    paths: getUniqueStartFinishCombos(scoredPaths)
  };

}

function getUniqueStartFinishCombos(scoredPaths) {
  const map = new Map();

  for (let sp of scoredPaths) {
    const existingPath = map.get(sp.key);

    if (!existingPath || sp.score < existingPath.score) {
      map.set(sp.key, sp);
    }
  }

  return [...map.values()];
}

function scorePath(path) {
  return path.reduce((score, step) => {
    switch (step) {
    case 'TRUSTS_EXPLICITLY':
      return score + 1;
    case 'TRUSTS':
      return score + 2;
    default:
      log.info(`What kind of path is this: ${step}?`);
      return score;
    }
  }, 0);
}

module.exports = {
  getNearestOpinions,
  getOpinions,
  getUserInfo,
  getOpinionById,
  getOrCreateOpinion,
  publishOpinion
};
