MATCH (p:Person)
CREATE (e:Email)<-[:HAS_EMAIL]-(p)
SET e.email = REPLACE(LOWER(p.name), " ", ".") + "@gmail.com"

MATCH (p:Person)
WHERE p.id % 4 = 0
CREATE (e:Email)<-[:HAS_EMAIL]-(p)
SET e.email = SPLIT(LOWER(p.name), " ")[1] + "." + SPLIT(LOWER(p.name), " ")[0] + "@hotmail.com"

CREATE CONSTRAINT ON (e:Email) ASSERT e.email IS UNIQUE

MATCH (e:Email)<-[:HAS_EMAIL]-(p:Person)
WHERE e.email = "bigdiver.seeker@gmail.com"
WITH p
MATCH (em:Email)<-[:HAS_EMAIL]-(p)
RETURN p, collect(em.email)
