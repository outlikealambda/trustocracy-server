MATCH (o:Opinion)-->(t:Topic)
WHERE t.id = 2
WITH o
ORDER BY o.influence ASC
RETURN o, count(o)
