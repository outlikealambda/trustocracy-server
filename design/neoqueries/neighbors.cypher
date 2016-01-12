MATCH (u:Person {id:1})-[relationship]->(friend)
RETURN u, type(relationship) as rel, friend
