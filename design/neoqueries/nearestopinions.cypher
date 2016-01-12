MATCH (p:Person)-[]->(f:Person)-[rs*0..]->(ff:Person)-[:OPINES]->(o:Opinion)-[:SIDES_WITH]->(s:Stance)<-[:ADDRESSED_BY]-(t:Topic)
WHERE p.id=1 AND t.id=1
RETURN f, extract(r in rs | type(r)) as extracted, ff, o, s
