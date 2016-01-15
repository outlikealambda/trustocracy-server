var
  rp = require('request-promise'),
  auth = {
    auth: { username: 'neo4j', password: 'graphdb'}
  };


function queryNeo4j(cypherQuery) {
  var options = Object.assign({
    method:'POST',
    url: getCypherUrl(),
    json: createStatement(cypherQuery)
  }, auth);

  return rp(options);
}

function getCypherUrl() {
  return getBaseUrl() + 'db/data/transaction/commit';
}

function getBaseUrl() {
  return 'http://localhost:7474/';
}

function createStatement(query) {
  return {
    statements: [
      {
        statement: query
      }
    ]
  };
}

module.exports = {
  query: queryNeo4j
};
