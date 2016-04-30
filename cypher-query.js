var
  rp = require('request-promise'),
  log = require('./logger'),
  options = {
    auth: { username: 'neo4j', password: 'graphdb'}
  };


function query(cypherQuery) {
  return queryWithParams(cypherQuery, {});
}

function queryWithParams(cypherQuery, params) {
  return rp(buildOptions(cypherQuery, params))
    .then(result => {
      log.info(result);
      return result;
    });
}

function buildOptions(cypherQuery, params) {
  const newOptions = Object.assign({
    method: 'POST',
    url: getCypherUrl(),
    json: createStatement(cypherQuery, params)
  }, options);

  log.info(newOptions.json.statements[0]);

  return newOptions;
}

function getCypherUrl() {
  return getBaseUrl() + 'db/data/transaction/commit';
}

function getBaseUrl() {
  return 'http://localhost:7474/';
}

function createStatement(query, params) {
  return {
    statements: [
      {
        statement: query,
        parameters: params
      }
    ]
  };
}

module.exports = {
  query,
  queryWithParams
};
