MATCH (o:Opinion)
WITH o
MATCH (o)<--(w:Person)<-[*1..2]-(p:Person)
WITH o, count(distinct(p)) as influence
SET o.test = influence
