var Changeset = require("ep_etherpad-lite/static/js/Changeset");
var padManager = require("ep_etherpad-lite/node/db/PadManager");
var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");
var commentsXml = require("./commentsXml.js");
var xmlescape = require("xml-escape");
var utils = require("./exportUtils.js");

/*
 * getPadXmlDocument
 * Get a well-formed XML Document for a given pad.
 *
 * Wraps the line by line XML representing the pad content
 * in a root element and prepends an XML declaration
 */
var getPadXmlDocument = function(padId, reqOptions, callback) {
    padManager.getPad(padId, function (err, pad) {
        if (ERR(err, callback)) return;
        //commentsXml.init(padId);

        _getContentXml(pad, reqOptions, function (err, contentXml) {
            if (!ERR(err, callback)) {
                commentsXml.getCommentsXml(padId, function(xmlComments){
                    var outputXml = '<?xml version="1.0"?>\n<pad>\n<content>' + contentXml + '</content>\n' + xmlComments + '\n</pad>';
                    callback(null, outputXml);
                });
                
            }
        });
    });
};


/*
* Returns an XML fragment for the requested pad revision with pad contents.
 * The result is not well-formed.
 */
var _getContentXml = function (pad, reqOptions, callback) {
    var revNum = reqOptions.revision;

    if (revNum) {
        pad.getInternalRevisionAText(revNum, function (err, revisionAtext) {
            // TODO: was bedeutet es wenn ERR(err, callback) === true??
            var atext = ERR(err, callback) ? pad.atext : revisionAtext;

            callback(null, _getPadLinesXml(pad.pool, atext, reqOptions));
        });
    } else {
        callback(null, _getPadLinesXml(pad.pool, pad.atext, reqOptions));
    }
};


/*
 * _getPadLinesXml
 * Returns an XML fragment for the content (atext = attribs+text) of a pad.
 * The result is just a sequence of <line>...</line> elements, except if
 * lists up-translation is turned-on.
 *
 * The result is not well-formed.
 */
var _getPadLinesXml = function (apool, atext, reqOptions) {
    var textLines = atext.text.slice(0, -1).split('\n');
    var attribLines = Changeset.splitAttributionLines(atext.attribs, atext.text);

    /*
     * EPL has no concept of lists. It just has lines with a "list" linemarker.
     * The following code is mainly based on the code from the LaTeX export,
     * which might be based on some other export plugin.
     * I keep the comment although we're exporting XML, not LaTeX or HTML
     */
    var LineManager = function(){
        // Need to deal with constraints imposed on HTML lists; can
        // only gain one level of nesting at once, can't change type
        // mid-list, etc.
        // People might use weird indenting, e.g. skip a level,
        // so we want to do something reasonable there.  We also
        // want to deal gracefully with blank lines.
        // => keeps track of the parents level of indentation
        var lists = [];// e.g. [[1,'bullet'], [3,'bullet'], ...]
        var xmlPieces = [];
        return {
            startListItem: function(line, lineContent) {
                // do list stuff
                var whichList = -1; // index into lists or -1
                if (line.listLevel) {
                    whichList = lists.length;
                    for (var j = lists.length - 1; j >= 0; j--) {
                        if (line.listLevel <= lists[j][0]) {
                            whichList = j;
                        }
                    }
                }

                //means we are on a deeper level of indentation than the previous line
                if (whichList >= lists.length) {
                    lists.push([line.listLevel, line.listTypeName]);
                    xmlPieces.push("\n<list type='" + line.listTypeName + "'>\n<item>", lineContent || "\n"); // number or bullet
                } else { //means we are getting closer to the lowest level of indentation
                    while (whichList < lists.length - 1) {
                        xmlPieces.push("</item>\n</list>"); // number or bullet
                        lists.length--;
                    }
                    xmlPieces.push("</item>\n<item>", lineContent || "\n");
                }
            },
            closeListItemsIfNecessary: function() {
                //if was in a list: close it before
                while (lists.length > 0) {
                    xmlPieces.push("</item>\n</list>\n"); // number or bullet
                    lists.length--;
                }
            },
            pushContent: function(lineContent) {
                xmlPieces.push(lineContent, "\n");
            },
            finishAndReturnXml: function() {
                for (var k = lists.length - 1; k >= 0; k--) {
                    xmlPieces.push("\n</list>\n"); // number or bullet
                }
                return xmlPieces.join("");
            }
        };
    };

    var lineManager = new LineManager();

    for (var i = 0; i < textLines.length; i++) {
        var line = utils.analyzeLine(textLines[i], attribLines[i], apool, reqOptions);
        var lineContent = _getOneLineXml(line.text, line.aline, apool, reqOptions);
        
        //If we are inside a list
        if (line.listLevel && (reqOptions.lists === true)) {
            lineManager.startListItem(line, lineContent);
        } else { //outside any list
            lineManager.closeListItemsIfNecessary(line, lineContent);
            lineManager.pushContent(lineContent);
        }
    }

    return lineManager.finishAndReturnXml();
};



/*
 * _getOneLineXml
 * Returns an XML representation for a pad line.
 */
var _getOneLineXml = function(text, attribs, apool, reqOptions) {
    var lmkr = false;
    var lineAttributes = [];
    var xmlStringAssembler = Changeset.stringAssembler();
    var urls = null;
    var textIterator = Changeset.stringIterator(text);

    var props   = utils.getPropertyNames(apool);
    var anumMap = utils.populateAnumMap(props);


    utils.openElements.init(); // no elements are open



    /*
     * getLineSegmentXml
     * Gets text with length of 'numChars' starting from current position of lineIterator.
     * Returns both, text with markup and plain text as literal object
     * { withMarkup: ..., plainText: ... }
     *
     */
    function getLineSegmentXml(lineIterator, lineLength, numChars) {
            if (numChars <= 0) {
                    return {
                            withMarkup: "",
                            plainText:  ""
                    };
            } else {
                    var lineSegmentWithMarkup = "";
                    var lineSegmentWithoutMarkup = "";

                    utils.operationHandler.init(anumMap, props, apool, lineIterator);

                    // current position on the line iteration
                    var fromIdx = utils.getIteratorIndex(lineIterator, lineLength);

                    var opIterator = Changeset.opIterator(Changeset.subattribution(attribs, fromIdx, fromIdx + numChars));

                    // begin iteration over spans (=operations) in line segment
                    while (opIterator.hasNext()) {
                            var currentOp = opIterator.next();
                            var opXml = utils.operationHandler.getXml(currentOp);
                            lineSegmentWithMarkup += opXml.withMarkup;
                            lineSegmentWithoutMarkup += opXml.plainText;
                    } // end iteration over spans in line segment

                    return {
                            withMarkup: lineSegmentWithMarkup + utils.operationHandler.getEndTagsAfterLastOp(),
                            plainText:  lineSegmentWithoutMarkup
                    };
            }
    } // end getLineSegmentXml


    if (reqOptions.lineattribs === true) {
            // start lineMarker (lmkr) check
            var firstCharacterOfLineOpIterator = Changeset.opIterator(Changeset.subattribution(attribs, 0, 1));

            if (firstCharacterOfLineOpIterator.hasNext()) {
                    var singleOperation = firstCharacterOfLineOpIterator.next();

                    // iterate through attributes
                    Changeset.eachAttribNumber(singleOperation.attribs, function (a) {
                            lineAttributes.push([apool.numToAttrib[a][0], apool.numToAttrib[a][1]]);

                            if (apool.numToAttrib[a][0] === "lmkr") {
                                    lmkr = true;
                            }
                    });
            }

            if (lmkr) {
                    textIterator.skip(1); // begin attribute processing after lmkr character
            }

    }

    /*
     * Process URIs
     */
    if (reqOptions.regex) {
            urls = utils.findURLs(text);
    }

    if (urls) {
            urls.forEach(function (urlData) {
                    var startIndex = urlData[0];
                    var url = urlData[1];
                    var urlLength = url.length;


                    xmlStringAssembler.append(getLineSegmentXml(textIterator, text.length, startIndex - utils.getIteratorIndex(textIterator, text.length)).withMarkup);

                    var uriText = getLineSegmentXml(textIterator, text.length, urlLength);

                    xmlStringAssembler.append('<matched-text key="uri" value="' + uriText.plainText + '">' + uriText.withMarkup + '</matched-text>');
            });
    }



    xmlStringAssembler.append(getLineSegmentXml(textIterator, text.length, textIterator.remaining()).withMarkup);

    var lineContentString = xmlStringAssembler.toString();


    return utils.createLineElement(lineAttributes, lineContentString, lmkr);


}; // end _getOneLineXml


/*
 * Define exports
 *
 */
exports.getPadXmlDocument = getPadXmlDocument;

