MATCH (u:Person), (d:Person)
WHERE u.id = 1 AND d.id = 0
DELETE r
CREATE (u)-[:${relationship}]->(d)
