MATCH (t:Topic)
SET t.created = round(rand() * (1467490675 - 1447891200) + 1447891200)

MATCH (o:Opinion) --> (t:Topic)
SET o.created = round(rand() * (1467490675 - t.created) + t.created)
