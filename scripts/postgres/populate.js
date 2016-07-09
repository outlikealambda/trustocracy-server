const
  connectionString = 'postgres://wr:@localhost/trusto',
  logger = require('../../logger'),
  db = require('pg-promise')()(connectionString);

const
  // ASSESS example

  // cokePepsiSnapple = {
  //   type: 'ASSESS',
  //   label: 'STANDARD',
  //   prompt: 'How delicious would you rate each of these?',
  //   promptShort: 'Deliciousness?',
  //   options: {
  //     endpoints: [
  //       {
  //         id : 0,
  //         label : 'Not delicious'
  //       },
  //       {
  //         id: 1,
  //         label: 'Delicious'
  //       }
  //     ],
  //     sliders: [
  //       {
  //         id : 0,
  //         label : 'Coke'
  //       },
  //       {
  //         id : 1,
  //         label : 'Pepsi'
  //       },
  //       {
  //         id : 0,
  //         label : 'Snapple'
  //       }
  //     ]
  //   }
  // },
  respectful = {
    type: 'ASSESS',
    label: 'STANDARD',
    prompt: 'How would you characterize the tone of this opinion?',
    prompt_short: 'Aggressive or Calm?',
    options: {
      endpoints: [
        {
          id : 0,
          label : 'Whoa, chill out!'
        },
        {
          id: 1,
          label: 'Zzzzzzzzz'
        }
      ]
    }
  },

  balanced = {
    type: 'ASSESS',
    label: 'STANDARD',
    prompt: 'How does this opinion state its argument?',
    prompt_short: 'Offense or Defense?',
    options: {
      endpoints: [
        {
          id : 0,
          label : 'I am right!'
        },
        {
          id: 1,
          label: 'You are wrong!'
        }
      ]
    }
  },

  facts = {
    type: 'ASSESS',
    label: 'STANDARD',
    prompt: 'How thorough was this opinion?',
    prompt_short: 'Length',
    options: {
      endpoints: [
        {
          id : 0,
          label : 'Post-it note'
        },
        {
          id: 1,
          label: 'Phone book'
        }
      ]
    }
  },

  complexity = {
    type: 'ASSESS',
    label: 'STANDARD',
    prompt: '',
    prompt_short: 'Complex or Basic',
    options: {
      endpoints: [
        {
          id: 0,
          label: 'Green Eggs and Ham'
        },
        {
          id: 1,
          label: 'Rocket Science 301'
        }
      ]
    }
  },

  learn = {
    type: 'PICK_ONE',
    label: 'STANDARD',
    prompt: 'Does this opinion bring some fresh perspective?',
    prompt_short: 'Got Fresh?',
    options: {
      answers: [
        {
          id : 0,
          label : 'I learned something!'
        },
        {
          id: 1,
          label: 'Stale, like chips in humidity'
        }
      ]
    }
  },

  changeYourMind = {
    type: 'PICK_ONE',
    label: 'STANDARD',
    prompt: 'Did this opinion change your perspective on the issue?',
    prompt_short: 'Change Your Mind?',
    options: {
      answers: [
        {
          id : 0,
          label : 'This is totally mind-changing'
        },
        {
          id : 1,
          label : 'I learned more about why I was right'
        },
        {
          id : 2,
          label : 'I already knew and agreed with these points'
        },
        {
          id: 3,
          label: 'Nope. Not persuasive enough'
        }
      ]
    }
  },

  warmAndFuzzy = {
    type: 'PICK_ONE',
    label: 'STANDARD',
    prompt: 'Does this make you feel warm and fuzzy?',
    prompt_short: 'Warm and Fuzzy?',
    options: {
      answers: [
        {
          id : 0,
          label : 'Warm and fuzzy'
        },
        {
          id: 1,
          label: 'Not warm and fuzzy'
        },
        {
          id: 2,
          label: 'Ice cold and smooth'
        }
      ]
    }
  },
  standard = [respectful, balanced, facts, complexity, learn, changeYourMind, warmAndFuzzy],
  topics = [0,1,2,3,4,5,6,7,8];


standard.forEach(question => {
  const insertStatement =
    `insert into question(type, label, prompt, prompt_short, options)
     values($<type>, $<label>, $<prompt>, $<prompt_short>, $<options>)
     returning id`;

  db.one(insertStatement, question)
    .then(data => data.id)
    .then(qid => {
      return db.batch(topics.map(tid => db.one('insert into topic_question(topic_id, question_id) values($1, $2) returning id', [tid, qid])));
    })
    .then(data => logger.info(data));
});
