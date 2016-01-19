# A node wrapper for the trustocracy Neo4j graph

## Graph Generation

run `node --harmony_destructuring generation.js`

graph size and connectivity are controlled by
* `graphSize`
* `nodesPerOpinion`
* `explicitProbability`
* `regularProbability`

## Graph API

run `node --harmony_destructuring app.js`

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
