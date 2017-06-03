const rdb = require('../../db/relational/rdb.js');
const humps = require('humps');

const topics = [
  {
    topicId: 0,
    prompts: [
      {
        type: 'SCALAR',
        text: 'How do you generally feel about Hillary?',
        textShort: 'Hillary?',
        options: [
          {
            text: 'Strongly dislike'
          },
          {
            text: 'Strongly like'
          }
        ]
      },
      {
        type: 'SCALAR',
        text: 'How do you generally feel about Donald?',
        textShort: 'Donald?',
        options: [
          {
            text: 'Strongly dislike'
          },
          {
            text: 'Strongly like'
          }
        ]
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: 'Who is more trustworthy?',
        textShort: 'Trustworthy?',
        options: [
          {
            text: 'Hillary'
          },
          {
            text: 'Donald'
          },
          {
            text: 'Both'
          },
          {
            text: 'Neither'
          }
        ]
      }
    ]
  },
  {
    topicId: 1,
    prompts: [
      {
        type: 'SCALAR',
        text: 'How do you feel about the Telescope?',
        textShort: 'Telescope?',
        options: [
          {
            text: 'Strongly negative'
          },
          {
            text: 'Strongly positive'
          }
        ]
      },
      {
        topicId: 1,
        type: 'SCALAR',
        text: 'How was the initial plan handled?',
        textShort: 'First attempt?',
        options: [
          {
            text: 'Poorly'
          },
          {
            text: 'Well'
          }
        ]
      },
      {
        topicId: 1,
        type: 'MULTIPLE_CHOICE',
        text: 'What would it take to get it built?',
        textShort: 'Possible?',
        options: [
          {
            text: 'Never'
          },
          {
            text: 'Change required'
          },
          {
            text: 'Fine as-is'
          }
        ]
      }
    ]
  },
  {
    topicId: 2,
    prompts: [
      {
        type: 'SCALAR',
        text: 'How do you feel about Rail in general?',
        textShort: 'Rail?',
        options: [
          {
            text: 'Strongly negative'
          },
          {
            text: 'Strongly positive'
          }
        ]
      },
      {
        topicId: 2,
        type: 'MULTIPLE_CHOICE',
        text: 'At what point did this become problematic?',
        textShort: 'Problem Roots?',
        options: [
          {
            text: 'Concept'
          },
          {
            text: 'Planning'
          },
          {
            text: 'Execution'
          }
        ]
      },
      {
        topicId: 2,
        type: 'MULTIPLE_CHOICE',
        text: 'Is a property tax increase part of the solution?',
        textShort: 'Property tax hike?',
        options: [
          {
            text: 'Yes'
          },
          {
            text: 'No'
          }
        ]
      }
    ]
  },
  {
    topicId: 3,
    prompts: [
      {
        type: 'SCALAR',
        text: 'A sample scalar prompt?',
        textShort: 'Direction?',
        options: [
          {
            text: 'Left'
          },
          {
            text: 'Right'
          }
        ]
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: 'A sample multiple choice prompt?',
        textShort: 'Letter?',
        options: [
          {
            text: 'A'
          },
          {
            text: 'B'
          },
          {
            text: 'C'
          },
          {
            text: 'D'
          }
        ]
      }
    ]
  },
  {
    topicId: 4,
    prompts: [
      {
        type: 'SCALAR',
        text: 'A sample scalar prompt?',
        textShort: 'Direction?',
        options: [
          {
            text: 'Left'
          },
          {
            text: 'Right'
          }
        ]
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: 'A sample multiple choice prompt?',
        textShort: 'Letter?',
        options: [
          {
            text: 'A'
          },
          {
            text: 'B'
          },
          {
            text: 'C'
          },
          {
            text: 'D'
          }
        ]
      }
    ]
  },
  {
    topicId: 5,
    prompts: [
      {
        type: 'SCALAR',
        text: 'A sample scalar prompt?',
        textShort: 'Direction?',
        options: [
          {
            text: 'Left'
          },
          {
            text: 'Right'
          }
        ]
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: 'A sample multiple choice prompt?',
        textShort: 'Letter?',
        options: [
          {
            text: 'A'
          },
          {
            text: 'B'
          },
          {
            text: 'C'
          },
          {
            text: 'D'
          }
        ]
      }
    ]
  },
  {
    topicId: 6,
    prompts: [
      {
        type: 'SCALAR',
        text: 'Is the current level of police oversight ok?',
        textShort: 'Now?',
        options: [
          {
            text: 'Terrible'
          },
          {
            text: 'Amazing'
          }
        ]
      },
      {
        topicId: 6,
        type: 'MULTIPLE_CHOICE',
        text: 'Should police officers wear body cameras?',
        textShort: 'Body Cameras?',
        options: [
          {
            text: 'Yes'
          },
          {
            text: 'No'
          }
        ]
      },
      {
        topicId: 6,
        type: 'MULTIPLE_CHOICE',
        text: 'Who should have access to footage from the cameras?',
        textShort: 'Footage?',
        options: [
          {
            text: 'Internal'
          },
          {
            text: 'Courts'
          },
          {
            text: 'Public'
          }
        ]
      }
    ]
  },
  {
    topicId: 7,
    prompts: [
      {
        type: 'SCALAR',
        text: 'A sample scalar prompt?',
        textShort: 'Direction?',
        options: [
          {
            text: 'Left'
          },
          {
            text: 'Right'
          }
        ]
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: 'A sample multiple choice prompt?',
        textShort: 'Letter?',
        options: [
          {
            text: 'A'
          },
          {
            text: 'B'
          },
          {
            text: 'C'
          },
          {
            text: 'D'
          }
        ]
      }
    ]
  },
  {
    topicId: 8,
    prompts: [
      {
        type: 'SCALAR',
        text: 'A sample scalar prompt?',
        textShort: 'Direction?',
        options: [
          {
            text: 'Left'
          },
          {
            text: 'Right'
          }
        ]
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: 'A sample multiple choice prompt?',
        textShort: 'Letter?',
        options: [
          {
            text: 'A'
          },
          {
            text: 'B'
          },
          {
            text: 'C'
          },
          {
            text: 'D'
          }
        ]
      }
    ]
  },
  {
    topicId: 9,
    prompts: [
      {
        type: 'SCALAR',
        text: 'A sample scalar prompt?',
        textShort: 'Direction?',
        options: [
          {
            text: 'Left'
          },
          {
            text: 'Right'
          }
        ]
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: 'A sample multiple choice prompt?',
        textShort: 'Letter?',
        options: [
          {
            text: 'A'
          },
          {
            text: 'B'
          },
          {
            text: 'C'
          },
          {
            text: 'D'
          }
        ]
      }
    ]
  }
];

topics.map(topic => {
  topic.prompts.map(prompt => {
    return rdb
      .insert(
        humps.decamelizeKeys({
          topicId: topic.topicId,
          type: prompt.type,
          text: prompt.text,
          textShort: prompt.textShort
        }),
        'id'
      )
      .into('prompt')
      .then(([promptId]) => {
        console.log('prompt id', promptId);

        return prompt.options.map((option, sortOrder) => {
          console.log('option', option);

          return rdb
            .insert(
              humps.decamelizeKeys({
                promptId,
                sortOrder,
                text: option.text
              }),
              'id'
            )
            .into('option')
            .then(([optionId]) => console.log('option result', optionId));
        });
      })
      .then(results => console.log('results', results));
  });
});
