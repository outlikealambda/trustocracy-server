# A node wrapper for the trustocracy Neo4j graph

## Graph Generation

See [trustocracy-graph-generation](https://github.com/outlikealambda/trustocracy-graph-generation) repository.

## Graph API

run `node app`

### Topics
`topic`

* returns a list of topics
* TODO: support sorted by created date, last updated opinion date, and opinion count

```
[
  {
    "created": "2016-11-06T00:36:59.525Z",
    "id": 3,
    "text": "Topic Thunder",
    "opinionCount": 42,
    "lastUpdated": "2017-02-07T12:43:52.415Z"
  }
]
```

### Topic
`topic/:topicId`

* returns a single topic by id

```
{
  "created": "2016-11-06T00:36:59.525Z",
  "id": 3,
  "text": "Topic Thunder",
  "opinionCount": 42,
  "lastUpdated": "2017-02-07T12:43:52.415Z"
}
```

### Opinions by Topic
`topic/:topicId/opinions`

* returns all opinions sorted by influence for a topic
* authors are attached

```
[
  {
    "author": {
      "name": "Julius Herzog",
      "id": 1688
    },
    "id": 25,
    "created": "2016-04-24T11:58:11.866Z",
    "influence": 3159
  }
]
```

### Opinion
`opinion/:opinionId`

* return full opinion with author and topic information

```
{
  "author": {
    "name": "Julius Herzog",
    "id": 1688
  },
  "topic": {
    "created": "2016-11-06T00:36:59.525Z",
    "id": 3,
    "text": "Topic Thunder"
  },
  "id": 25,
  "created": "2016-04-24T11:58:11.866Z",
  "influence": 3159,
  "text": "This is the entirety of the opinion and could be quite long..."
}
```

### getNearestOpinions
`user/:id/topic/:id/opinions`

* returns any opinion within 4 edges (currently hard-coded)
* returns each possible path to those opinions
* each path starts with an immediate `friend` of the user
* each path ends with the `opiner` who wrote the opinion
* omits any paths which duplicate the same `friend` and `opiner` node
* in the case of duplicates the result with the lowest `score` is selected
* to score, TRUSTS\_EXPLICITLY = 1 and TRUSTS = 2

```
{
  "paths": [{
    "friend" : {
      "name" : String,
      "id" : Int
    },
    "path" : [
      TRUSTS_EXPLICITLY | TRUSTS,
      ...
    ],
    "opiner" : {
      "name" : String,
      "id" : Int
    },
    "opinion" : Int,
    "score" : Int,
    "key" : String => Id:Id
  }]
}
```

### getUserInfo
`user/:id`

```
{
  "user" : {
    "name" : String,
    "id" : Int
  },
  "neighbors" : [
    {
      "rel" : TRUSTS_EXPLICITLY | TRUSTS,
      "friend" : {
        "name" : String,
        "id" : Int
      }
    }
  ]
}
```
