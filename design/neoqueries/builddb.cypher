CREATE (wr:Person { id:1, name: "wr" }),
       (me:Person { id:2, name: "me" }),
       (ky:Person { id:3, name: "ky" }),
       (mm:Person { id:4, name: "mm" }),
       (bj:Person { id:5, name: "bj" }),
       (op1:Opinion { id: 1, text:"I have this amazing, favorable opinion" }),
       (op2:Opinion { id: 2, text:"I have this amazing, unfavorable opinion" }),
       (f:Stance {id: 1, text: "Favorable"}),
       (uf:Stance {id: 2, text: "Unfavorable"}),
       (t:Topic {id: 1, text: "This topic is important!"}),
       (wr)-[:TRUSTS_EXPLICITLY {c:1}]->(me),
       (wr)-[:TRUSTS_EXPLICITLY {c:1}]->(ky),
       (wr)-[:TRUSTS_EXPLICITLY {c:1}]->(mm),
       (wr)-[:TRUSTS_EXPLICITLY {c:1}]->(bj),
       (me)-[:TRUSTS_EXPLICITLY {c:1}]->(ky),
       (ky)-[:TRUSTS_EXPLICITLY {c:1}]->(mm),
       (mm)-[:TRUSTS_EXPLICITLY {c:1}]->(bj),
       (bj)-[:OPINES]->(op1),
       (mm)-[:OPINES]->(op2),
       (op1)-[:SIDES_WITH]->(f),
       (op2)-[:SIDES_WITH]->(uf),
       (t)-[:ADDRESSED_BY]->(f),
       (t)-[:ADDRESSED_BY]->(uf)


// Delete All
MATCH (n) OPTIONAL MATCH (n)-[r]-() DELETE n,r
