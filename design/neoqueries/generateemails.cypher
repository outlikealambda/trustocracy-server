MATCH (p:Person)
SET p.email = REPLACE(p.name, " ", ".") + "@gmail.com"
