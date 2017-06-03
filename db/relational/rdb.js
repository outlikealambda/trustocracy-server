const db = require('knex')(
  {
    client: 'pg',
    connection: {
      host: 'localhost',
      user: 'trusto',
      port: '5432',
      database: 'trusto_2'
    }
  }
);

module.exports = db;
