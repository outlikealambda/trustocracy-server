var
  rp = require('request-promise'),
  options = {
    auth: { username: 'neo4j', password: 'graphdb'}
  },
  log = require('./logger');


function query(cypherQuery) {
  return queryWithParams(cypherQuery, {});
}

function queryWithParams(cypherQuery, params) {
  log.info(cypherQuery, params);
  return rp(buildOptions(cypherQuery, params));
}

function buildOptions(cypherQuery, params) {
  return Object.assign({
    method: 'POST',
    url: getCypherUrl(),
    json: createStatement(cypherQuery, params)
  }, options);
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
        parameters: {
          props: params
        }
      }
    ]
  };
}

module.exports = {
  query,
  queryWithParams
};
