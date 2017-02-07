To import a 10000 node db with ranked relationships (assumes from this directory on the command line)
- stop neo4j (`neo4j stop`)
- run:
```
neo4j-import --into pathToSomewhere/databases/pick_a_name.db --id-type integer --multiline-fields=true             
             --nodes:Person static/persons.csv --nodes:Email static/emails.csv --nodes:Opinion static/opinions.csv              
             --relationships:RANKED static/tenThousandRanked.csv --relationships:HAS_EMAIL static/hasEmail.csv
```
- go to your config file, likely located at `/usr/local/Cellar/neo4j/<version>/libexec/conf/neo4j.conf`
- set the property `data.directories.data=pathToSomewhere`
- set the property `dbms.active_database=pick_a_name.db`
- start neo4j (`neo4j start`)

Notes:

- `pathToSomewhere` can be any path on your machine, but the `databases` directory needs to be at the end of that path
- do _NOT_ include `databases` in the `data.directories.data` property in the config file

