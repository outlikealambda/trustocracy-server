MATCH (u:Person)-[:HAS_EMAIL]->(e:Email)
WHERE u.id = 1736
WITH u, collect(e.email) as emails
MATCH (u)-[r]->(f:Person)
RETURN u as user, emails, collect({friend: f, relationship: type(r)}) as neighbors
