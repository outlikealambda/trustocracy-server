'use strict';

var
  join = require('bluebird').join,
  cq = require('./cypherQuery');

function getUserInfo(id) {
  return join(getUser(id), getUserNeighbors(id), combineUserAndNeighbors);
}

function getUser(id) {
  return cq.query(createUserQuery(id)).then(transformUserData);
}

function getUserNeighbors(id) {
  return cq.query(createNeighborsQuery(id)).then(transformNeighborsData);
}

function getNearestOpinions(userId, topicId) {
  console.time('opinions');
  return cq.query(createNearestOpinionsQuery(userId, topicId))
    .then(neoData => {
      console.timeEnd('opinions');
      return neoData;
    })
    .then(transformNearestOpinionsData);
}

function getOpinions(ids) {
  return cq.query(createOpinionsQuery(ids))
    .then(transformOpinions);
}

function createUserQuery(id) {
  return `MATCH (u:Person {id:${id}})
          RETURN u`;
}

function createNeighborsQuery(id) {
  return `MATCH (u:Person {id:${id}})-[relationship]->(friend:Person)
          RETURN u, type(relationship) as r, friend`;
}

function createNearestOpinionsQuery(userId, topicId) {
  return `MATCH (p:Person)-[:TRUSTS_EXPLICITLY|:TRUSTS]->(f:Person)-[rs:TRUSTS_EXPLICITLY|:TRUSTS*0..3]->(ff:Person)-[:OPINES]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
          WHERE p.id=${userId} AND t.id=${topicId}
          RETURN f, extract(r in rs | type(r)) as extracted, ff, o`;
}

function createOpinionsQuery(ids) {
  var idList = ids.join();
  return `MATCH (o:Opinion)
          WHERE o.id IN [${idList}]
          RETURN o`;
}

function combineUserAndNeighbors(user, neighbors) {
  return {
    user,
    neighbors
  };
}

function transformUserData(neoData) {
  const [{data: [{row: [user]}]}] = neoData.results;

  return user;
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

  // console.log(scoredPaths);

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
      console.log(`What kind of path is this: ${step}?`);
      return score;
    }
  }, 0);
}

module.exports = {
  getNearestOpinions,
  getOpinions,
  getUserInfo
};
