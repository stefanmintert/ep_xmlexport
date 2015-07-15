#/bin/bash

ETHERPAD_HOST="http://localhost:49001"

mkdir -p outputXml
mkdir -p outputJson

# -r prevents backslash escapes from being interpreted.
# || [[ -n $line ]] prevents the last line from being ignored if it doesn't end with a \n (since read returns a non-zero exit code when it encounters EOF).
while read -r line || [[ -n $line ]]; do
    # skip lines beginning with '#'
    [[ "$line" =~ ^#.*$ ]] && continue
    # skip empty lines
    [[ "$line" =~ ^$ ]] && continue
    
    echo "run testcase: $line"
    TESTCASE="test-$line"
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/xml > outputXml/$TESTCASE.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/xml?lineattribs=true > outputXml/$TESTCASE-lineattribs.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/xml?lists=true > outputXml/$TESTCASE-lists.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/xml?lists=true\&lineattribs=true > outputXml/$TESTCASE-lists_lineattribs.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/xml?regex=true > outputXml/$TESTCASE-regex.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/xml?pretty=true > outputXml/$TESTCASE-pretty.xml

    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/json > outputJson/$TESTCASE.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/json?lineattribs=true > outputJson/$TESTCASE-lineattribs.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/json?lists=true > outputJson/$TESTCASE-lists.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/json?lists=true\&lineattribs=true > outputJson/$TESTCASE-lists_lineattribs.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/json?regex=true > outputJson/$TESTCASE-regex.xml
    curl --silent $ETHERPAD_HOST/p/$TESTCASE/export/json?pretty=true > outputJson/$TESTCASE-pretty.xml
done < "testcases.list" 

diff -q referenceXml/ outputXml/ && echo "[OK] Tests run successfully!"
