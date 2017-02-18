const connectionString = 'postgres://trusto:@localhost/trusto';
const logger = require('../../logger');
const db = require('pg-promise')()(connectionString);

const question =
  `CREATE TABLE IF NOT EXISTS question (
    id serial PRIMARY KEY,
    topic_id int,
    prompt text,
    prompt_short varchar(140)
  )`;

const option =
  `CREATE TABLE IF NOT EXISTS option (
    id serial PRIMARY KEY,
    description varchar(140),
    sort_order int,
    question_id int,
    FOREIGN KEY (question_id) REFERENCES question(id),
    UNIQUE(question_id, sort_order)
  )`;

const answer =
  `CREATE TABLE IF NOT EXISTS answer (
    id serial PRIMARY KEY,
    topic_id int,
    opinion_id int,
    user_id int,
    question_id int,
    option_id int,
    timestamp timestamptz default current_timestamp,
    FOREIGN KEY (question_id) REFERENCES question(id),
    FOREIGN KEY (option_id) REFERENCES option(id)
  )`;

db.none(question)
  .then(() => db.none(option))
  .then(() => db.none(answer))
  .then(() => {
    logger.info('Finished creating tables');
    process.exit(0);
  })
  .catch(err => {
    logger.error(err);
    process.exit(1);
  });
