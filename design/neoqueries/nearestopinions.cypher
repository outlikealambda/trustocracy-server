MATCH (p:Person)-[]->(f:Person)-[rs*0..]->(ff:Person)-[:OPINES]->(o:Opinion)-[:SIDES_WITH]->(s:Stance)<-[:ADDRESSED_BY]-(t:Topic)
WHERE p.id=1 AND t.id=1
RETURN f, extract(r in rs | type(r)) as extracted, ff, o, s

MATCH (p:Person)-[rf:TRUSTS_EXPLICITLY]->(f:Person)-[rs*0..2]->(ff:Person)-[:OPINES]->
(o:Opinion)-[:ADDRESSES]->(t:Topic)
WHERE p.id=0 AND t.id=0
RETURN type(rf), f, extract(r in rs | type(r)) as extracted, ff, o.id

// GROUPED BY OPINION + AUTHOR

MATCH (author:Person)-[:OPINES]->(o:Opinion)-[:ADDRESSES]->(t:Topic {id:4})
WITH o, author
MATCH (u:Person {id:101})-[fr:TRUSTS_EXPLICITLY|:TRUSTS]->(f:Person)-[rs:TRUSTS_EXPLICITLY|:TRUSTS*0..3]->(author)
RETURN o, author, COLLECT([type(fr), f, extract(r in rs | type(r))]) as connections
