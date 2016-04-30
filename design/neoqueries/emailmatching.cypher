MATCH (u:Person), (n)-[:HAS_EMAIL]->(e:Email)
WHERE e.email in ['test@gmail.com'] WHERE u.id = 1
CREATE (u)-[:CANDIDATE]->(n)
RETURN e, n
