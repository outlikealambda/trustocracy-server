## Goals

1. Define user-answered poll questions on a per-topic basis
  - how balanced is this opinion?
  - how persuasive is this opinion?

2. Calculate basic metrics based on the poll answers
  - 62% of people are in favor of Trump

3. Allow filtering of opinions based on metrics
  - show pro-trump opinions
  - sort by opinion persuasiveness

## Implementation

### Use a relational database

- Since we'll be doing lots of calculations on large sets of records, composite indices will be handy.
- Figuring out how to write the above

### Model

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
