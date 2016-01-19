MATCH (p:Person)-[]->(f:Person)-[rs*0..]->(ff:Person)-[:OPINES]->(o:Opinion)-[:SIDES_WITH]->(s:Stance)<-[:ADDRESSED_BY]-(t:Topic)
WHERE p.id=1 AND t.id=1
RETURN f, extract(r in rs | type(r)) as extracted, ff, o, s

MATCH (p:Person)-[rf:TRUSTS_EXPLICITLY]->(f:Person)-[rs*0..2]->(ff:Person)-[:OPINES]->
(o:Opinion)-[:ADDRESSES]->(t:Topic)
WHERE p.id=0 AND t.id=0
RETURN type(rf), f, extract(r in rs | type(r)) as extracted, ff, o.id
