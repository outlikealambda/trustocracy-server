
const
  connectionString = 'postgres://wr:@localhost/trusto',
  logger = require('../../logger'),
  pgp = require('pg-promise')(),
  db = pgp(connectionString),
  query = require('./query');


function getQuestions(topicId) {
  return db
    .any(query.questions, {topicId})
    .then(res => logger.info(res));
}


module.exports = {
  getQuestions
};
