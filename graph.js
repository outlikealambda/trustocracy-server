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
  return cq.query(queryBuilder.user(id)).then(transformer.user);
}

function getUserNeighbors(id) {
  return cq.query(queryBuilder.neighbors(id)).then(transformer.neighbors);
}

function publishOpinion(userId, topicId, opinion) {
  // update/build the OPINES relationship with a timestamp
  return cq.query(queryBuilder.markPublished(userId, topicId))
    // write the new vals
    .then(() => cq.queryWithParams(queryBuilder.writeOpinion(opinion.id), opinion))
    .then(transformer.opinion);
}

function getOpinionById(opinionId) {
  return cq.query(queryBuilder.opinionById(opinionId))
    .then(transformer.opinion);
}

function getOpinionsByIds(ids) {
  return cq.query(queryBuilder.opinionsByIds(ids))
    .then(transformer.opinionsByIds);
}

function getOpinionsByTopic(topicId) {
  return cq.query(queryBuilder.opinionsByTopic(topicId))
    .then(transformer.opinionsByTopic);
}

function getOrCreateOpinion(userId, topicId) {
  return cq.query(queryBuilder.getOpinionByUserTopic(userId, topicId))
    .then(transformer.opinion)
    // if it doesn't exist, create it
    .then(opinion => opinion ? opinion : createOpinion(userId, topicId))
    // add in any missing fields.  lazy migrations could eventually run here
    .then(log.promise('post-creation'))
    .then(opinion => Object.assign({}, models.opinion, opinion));
}

function createOpinion(userId, topicId) {
  return cq.query(queryBuilder.createOpinion(userId, topicId, idGenerator.nextOpinionId()))
    .then(transformer.opinion);
}

function getNearestOpinions(userId, topicId) {
  log.time('opinions');
  return cq.query(queryBuilder.nearest(userId, topicId))
    .then(neoData => {
      log.timeEnd('opinions');
      return neoData;
    })
    .then(transformer.nearest);
}

function getTopic(id) {
  return cq.query(queryBuilder.topic(id))
    .then(transformer.topic);
}

function getTopics() {
  return cq.query(queryBuilder.topics())
    .then(transformer.topics);
}

const queryBuilder = {
  user: function(id) {
    return `MATCH (u:Person {id:${id}})
            RETURN u`;
  },
  neighbors: function(id) {
    return `MATCH (u:Person {id:${id}})-[relationship]->(friend:Person)
            RETURN u, type(relationship) as r, friend`;
  },
  nearest: function(userId, topicId) {
    return `MATCH (p:Person)-[:TRUSTS_EXPLICITLY|:TRUSTS]->(f:Person)-[rs:TRUSTS_EXPLICITLY|:TRUSTS*0..3]->(ff:Person)-[:OPINES]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
            WHERE p.id=${userId} AND t.id=${topicId}
            RETURN f, extract(r in rs | type(r)) as extracted, ff, o`;
  },
  opinionsByIds: function(ids) {
    const idList = ids.join();
    return `MATCH (o:Opinion)
            WHERE o.id IN [${idList}]
            RETURN o`;
  },
  opinionsByTopic: function (topicId) {
    return `MATCH (o:Opinion) --> (t:Topic)
            WHERE t.id = ${topicId}
            RETURN o`;

  },
  createOpinion: function(userId, topicId, opinionId) {
    return `MATCH (u:Person), (t:Topic)
            WHERE u.id=${userId} AND t.id=${topicId}
            CREATE (o:Opinion { id: ${opinionId} }),
            (u)-[:THINKS]->(o)-[:ADDRESSES]->(t)
            RETURN o`;
  },
  opinionById: function(opinionId) {
    return `MATCH (o:Opinion)
            WHERE o.id = ${opinionId}
            RETURN o`;
  },
  opinionByUserTopic: function(userId, topicId) {
    return `MATCH (p:Person)-[:THINKS|:OPINES]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
            WHERE p.id = ${userId} AND t.id = ${topicId}
            RETURN o`;
  },
  markPublished: function(userId, topicId) {
    return `MATCH (p:Person)-[:THINKS|:OPINES]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
            WHERE p.id = ${userId} AND t.id = ${topicId}
            MERGE (p)-[opines:OPINES]->(o)
            ON CREATE SET opines.created = timestamp(), opines.updated = timestamp()
            ON MATCH SET opines.updated = timestamp()
            RETURN opines`;
  },
  // props are passed in via queryWithParams 2nd arg
  writeOpinion: function(opinionId) {
    return `MATCH (o:Opinion)
            WHERE o.id = ${opinionId}
            SET o = { props }
            RETURN o`;
  },
  topic: function(topicId) {
    return `MATCH (t:Topic)
            WHERE t.id = ${topicId}
            RETURN t`;
  },
  topics: function() {
    return `MATCH (t:Topic) RETURN t`;
  }
};


const transformer = {
  user : extractFirstResult,

  opinion : extractFirstResult,

  opinionsByIds : extractFirstResults,

  opinionsByTopic : extractFirstResults,

  topic : extractFirstResult,

  topics : extractFirstResults,

  neighbors : function(neoData) {
    // destructuring: node needs to run with --harmony_destructuring flag
    const [{data}] = neoData.results;

    return data.map(datum => {
      const [, rel, friend] = datum.row;

      return {
        rel,
        friend
      };
    });
  },

  nearest : function(neoData) {
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
};

function combineUserAndNeighbors(user, neighbors) {
  return {
    user,
    neighbors
  };
}

// pulls out the first item in the first fow
function extractFirstResult(neoData) {
  if (noResults(neoData)) {
    return null;
  }

  const [{data: [{row: [first]}]}] = neoData.results;

  return first;
}

// pulls out the first item in each row
function extractFirstResults(neoData) {
  const [{data}] = neoData.results;

  return data.map(datum => {
    return datum.row[0];
  });
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
  getUserInfo,
  getOpinionById,
  getOpinionsByIds,
  getOpinionsByTopic,
  getOrCreateOpinion,
  publishOpinion,
  getTopic,
  getTopics
};
