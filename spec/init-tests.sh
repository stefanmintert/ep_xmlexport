#/bin/bash

ETHERPAD_HOST="http://localhost:49001"

# -r prevents backslash escapes from being interpreted.
# || [[ -n $line ]] prevents the last line from being ignored if it doesn't end with a \n (since read returns a non-zero exit code when it encounters EOF).
while read -r line || [[ -n $line ]]; do
    # skip lines beginning with '#'
    [[ "$line" =~ ^#.*$ ]] && continue
    # skip empty lines
    [[ "$line" =~ ^$ ]] && continue
    
    echo "run testcase: $line"
    TESTCASE="test-$line"
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/xml > referenceXml/$TESTCASE.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/xml?lineattribs=true > referenceXml/$TESTCASE-lineattribs.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/xml?lists=true > referenceXml/$TESTCASE-lists.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/xml?regex=true > referenceXml/$TESTCASE-regex.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/xml?pretty=true > referenceXml/$TESTCASE-pretty.xml
done < "testcases.list"