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
  balanced = {
    type: 'ASSESS',
    label: 'STANDARD',
    prompt: 'Is this opinion focused on a single aspect of the issue, or does it encompass a broad survey of many possible impacts?',
    prompt_short: 'Focused or Balanced?',
    options: {
      endpoints: [
        {
          id : 0,
          label : 'Super Focused'
        },
        {
          id: 1,
          label: 'Very Broad'
        }
      ],
      sliders: [
        {
          id : 0,
          label : ''
        }
      ]
    }
  },
  leaning = {
    type: 'ASSESS',
    label: 'STANDARD',
    prompt: 'Do you agree or disagree with the arguments of this opinion?',
    prompt_short: '+/- ?',
    options: {
      endpoints: [
        {
          id : 0,
          label : 'Agree'
        },
        {
          id: 1,
          label: 'Disagree'
        }
      ],
      sliders: [
        {
          id : 0,
          label : ''
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
  standard = [balanced, leaning, learn, changeYourMind, warmAndFuzzy],
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
