const connectionString = 'postgres://trusto:@localhost/trusto_2';
const logger = require('../../logger');
const db = require('pg-promise')()(connectionString);

const prompt =
  `CREATE TABLE IF NOT EXISTS prompt (
    id serial PRIMARY KEY,
    topic_id int,
    type varchar(31),
    text text,
    text_short varchar(140)
  )`;

const option =
  `CREATE TABLE IF NOT EXISTS option (
    id serial PRIMARY KEY,
    prompt_id int,
    sort_order int,
    text varchar(140),
    FOREIGN KEY (prompt_id) REFERENCES prompt(id),
    UNIQUE(prompt_id, sort_order)
  )`;

const answer =
  `CREATE TABLE IF NOT EXISTS answer (
    id serial PRIMARY KEY,
    opinion_id int,
    prompt_id int,
    selected int,
    value float,
    timestamp timestamptz default current_timestamp,
    FOREIGN KEY (prompt_id) REFERENCES prompt(id),
    UNIQUE(opinion_id, prompt_id)
  )`;

db.none(prompt)
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
