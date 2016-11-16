const
  connectionString = 'postgres://trusto:@localhost/trusto',
  logger = require('../../logger'),
  pgp = require('pg-promise')(),
  db = pgp(connectionString),
  question =
    `CREATE TABLE IF NOT EXISTS question (
      id serial PRIMARY KEY,
      type varchar(20),
      label varchar(20),
      prompt text,
      prompt_short varchar(140),
      options jsonb NOT NULL
    )`,
  answer =
    `CREATE TABLE IF NOT EXISTS answer(
      id serial PRIMARY KEY,
      topic_id int,
      opinion_id int,
      user_id int,
      question_id int,
      timestamp timestamptz default current_timestamp,
      picked int,
      rated double precision,
      FOREIGN KEY (question_id) REFERENCES question(id)
    )`,
  topicQuestion =
    `CREATE TABLE IF NOT EXISTS topic_question (
      id serial PRIMARY KEY,
      topic_id int,
      question_id int,
      FOREIGN KEY (question_id) REFERENCES question(id)
    )`;


db.none(question)
  .then(() => db.none(answer))
  .then(() => db.none(topicQuestion))
  .catch(err => logger.error(err));
