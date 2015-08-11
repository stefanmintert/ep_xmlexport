Using tests
=============

Run tests
----------

1. Create an etherpad instance, import mysql dump (testcases.sql) into epl database. This imports all the testdocuments replacing pads with the same id. 

```
    mysql -u <epluser> -p etherpad-lite < testcases.sql
```

2. You may need to edit ETHERPAD_HOST in run-tests.sh depending on your local settings (TODO: this should be configurable)
3. run run-tests.sh, it calls for exports on the running epl instance, stores them in outputXml/ and compares the to the reference files in referenceXml/

Create more testcases
-------------------

1. Create an etherpad instance, import mysql dump (testcases.sql) into epl database as above
2. Create test documents in etherpad and add an entry in testcases.list (document name "test-mytest" is refered as "mytest" in testcases.list
3. Run init-tests.sh to create reference data (in directory referenceXml), each document is exported with different query combinations (like lists=true, lineattribs=true)
4. Create a mysql dump from the running epl instance:

```
    mysqldump -u <epluser> -p --replace --no-create-info --extended-insert=FALSE --complete-insert=TRUE etherpad-lite > testcases.sql
```
