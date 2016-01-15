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
  return cq.query(createNearestOpinionsQuery(userId, topicId)).then(transformNearestOpinionsData);
}

function getOpinions(ids) {
  return cq.query(createOpinionsQuery(ids));
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
  return `MATCH (p:Person)-[]->(f:Person)-[rs:TRUSTS_EXPLICITLY*0..]->(ff:Person)-[:OPINES]->(o:Opinion)-[:SIDES_WITH]->(s:Stance)<-[:ADDRESSED_BY]-(t:Topic)
          WHERE p.id=${userId} AND t.id=${topicId}
          RETURN f, extract(r in rs | type(r)) as extracted, ff, o, s`;
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
  var
    [{data: [{row: [user]}]}] = neoData.results;

  return user;
}

function transformNeighborsData(neoData) {
  // destructuring: node needs to run with --harmony_destructuring flag
  var
    [{data}] = neoData.results;

  return data.map(datum => {
    var [, rel, friend] = datum.row;

    return {
      rel,
      friend
    };
  });
}

function transformNearestOpinionsData(neoData) {
  var [{data}] = neoData.results;

  return {
    paths: data.map(datum => {
      var [friend, path, opiner, opinion] = datum.row;

      return {
        friend,
        path,
        opiner,
        opinion: opinion.id
      };
    })
  };
}

module.exports = {
  getNearestOpinions,
  getOpinions,
  getUserInfo
};
