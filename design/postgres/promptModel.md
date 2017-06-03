## Goals

1. Define user-answered poll questions on a per-topic basis
  - how balanced is this opinion?
  - how persuasive is this opinion?

2. Calculate basic metrics based on the poll answers
  - 62% of people are in favor of Trump

3. Allow filtering of opinions based on metrics
  - show pro-trump opinions
  - sort by opinion persuasiveness

## Specific Queries

1. Give me all the opinions and their answers for a topic
  - group all answers by opinionId

2. Summarize the answers for a topic
  - group all answers by opinionId
  - weight by influence
  - aggregate stats

## Implementation

### Use a relational database

- Since we'll be doing lots of calculations on large sets of records, composite indices will be handy.
- Figuring out how to write the above

## Model, v2

### Answer
Either a MULTIPLE_CHOICE answer or a SCALAR answer

- id: serial
- prompt_id: FK prompt(id)
- opinion_id: int (neo4j FK)
- selected: option.id (FK if not null)
- value: float

All Topic Answers
```
SELECT answer.opinion_id, prompt.id, answer.value, answer.selected
  FROM prompt
  JOIN answer ON prompt.id = answer.prompt_id
  WHERE prompt.type = 'SCALAR'
    AND prompt.topic_id = $<topicId>
  ORDER BY answer.opinion_id, prompt.id
```

### Prompt
- id: serial
- topic_id: int (neo4j FK)
- text: text
- text_short: varchar(140)

### Option
- id: serial
- prompt_id: FK prompt(id)
- sort_order: int
- text

## Model, v1

**Answer**

Columns:
- id: serial
- answerType: varchar - PICK_ONE | ASSESS
- topicId : int
- opinionId : int
- userId : int
- questionId : int
- pickOne : Char - A | B | C | D | etc.
- assess : Float - [0, 1]

**Question**

Columns:
- id: serial
- type: varchar
- label: varchar
- options: jsonb

**Topic_Question**

Columns:
- id: serial
- topic_id: int
- question_id: int
