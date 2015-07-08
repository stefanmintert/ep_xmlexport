var Changeset = require("ep_etherpad-lite/static/js/Changeset");
var padManager = require("ep_etherpad-lite/node/db/PadManager");
var throwIfError = require("ep_etherpad-lite/node_modules/async-stacktrace");
var commentsXml = require("./commentsXml.js");
var xmlescape = require("xml-escape");
var utils = require("./exportUtils.js");
var OperationsToXmlTranslator = require("./OperationsToXml");

//var DROPATTRIBUTES = ["insertorder"]; // exclude attributes from export
var DROPATTRIBUTES = [];

/**
 * collects commentIds referenced in the processed document,
 * the list is used to filter all those comments that are not referenced
 * in the requested revision
 */
var CommentCollector = function(){
    var collectedCommentIds = [];
    return {
        add: function(commentId){
            collectedCommentIds.push(commentId);
        },
        list: function(){
            return collectedCommentIds;
        }
    };
};


/*
 * getPadXmlDocument
 * Get a well-formed XML Document for a given pad.
 *
 * Wraps the line by line XML representing the pad content
 * in a root element and prepends an XML declaration
 */
var getPadXmlDocument = function(padId, reqOptions, successCallback, errorCallback) {
    try {
        var commentCollector = new CommentCollector();
        _loadPadData(padId, reqOptions, function(apool, atext){
            var contentXml = _getPadLinesXml(apool, atext, reqOptions, commentCollector);

            commentsXml.getCommentsXml(padId, commentCollector.list(), function(commentsXml){
                var outputXml = '<?xml version="1.0"?>\n<pad>\n<content>' + contentXml + '</content>\n' + commentsXml + '\n</pad>';
                successCallback(outputXml);
            });
        });
    } catch(error) {
        errorCallback(error);
    }
};


function _loadPadData (padId, reqOptions, callback) {
    padManager.getPad(padId, function (err, pad) {
        throwIfError(err);
        
        if (reqOptions.revision) {
            pad.getInternalRevisionAText(reqOptions.revision, function (err, revisionAtext) {
                throwIfError(err);
                callback(pad.pool, revisionAtext);
            });
        } else {
            callback(pad.pool, pad.atext);
        }
    });
};


/*
 * EPL has no concept of lists. It just has lines with a "list" linemarker.
 * The following code is mainly based on the code from the LaTeX export,
 * which might be based on some other export plugin.
 * I keep the comment although we're exporting XML, not LaTeX or HTML
 */
var LineManager = function(listsEnabled){
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
        _startListItem: function(listLevel, listTypeName, lineContent) {
            // do list stuff
            var whichList = -1; // index into lists or -1
            if (listLevel) {
                whichList = lists.length;
                for (var j = lists.length - 1; j >= 0; j--) {
                    if (listLevel <= lists[j][0]) {
                        whichList = j;
                    }
                }
            }

            //means we are on a deeper level of indentation than the previous line
            if (whichList >= lists.length) {
                lists.push([listLevel, listTypeName]);
                xmlPieces.push("\n<list type='" + listTypeName + "'>\n<item>", lineContent || "\n"); // number or bullet
            } else { //means we are getting closer to the lowest level of indentation
                while (whichList < lists.length - 1) {
                    xmlPieces.push("</item>\n</list>"); // number or bullet
                    lists.length--;
                }
                xmlPieces.push("</item>\n<item>", lineContent || "\n");
            }
        },
        _closeListItemsIfNecessary: function() {
            //if was in a list: close it before
            while (lists.length > 0) {
                xmlPieces.push("</item>\n</list>\n"); // number or bullet
                lists.length--;
            }
        },
        _pushContent: function(lineContent) {
            xmlPieces.push(lineContent, "\n");
        },
        finishAndReturnXml: function() {
            for (var k = lists.length - 1; k >= 0; k--) {
                xmlPieces.push("\n</list>\n"); // number or bullet
            }
            return xmlPieces.join("");
        },
        processLine: function(listLevel, listTypeName, lineContent) {
            //If we are inside a list
            if (listLevel && listsEnabled) {
                this._startListItem(listLevel, listTypeName, lineContent);
            } else { //outside any list
                this._closeListItemsIfNecessary();
                this._pushContent(lineContent);
            }
        }
    };
};

/*
 * _getPadLinesXml
 * Returns an XML fragment for the content (atext = attribs+text) of a pad.
 * The result is just a sequence of <line>...</line> elements, except if
 * lists up-translation is turned-on.
 *
 * The result is not well-formed.
 */
var _getPadLinesXml = function (apool, atext, reqOptions, commentCollector) {
    var textLines = atext.text.slice(0, -1).split('\n');
    var attribLines = Changeset.splitAttributionLines(atext.attribs, atext.text);

    var lineManager = new LineManager(reqOptions.lists === true);

    for (var i = 0; i < textLines.length; i++) {
        var line = utils.analyzeLine(textLines[i], attribLines[i], apool, reqOptions.lists === true);
        var lineContent = _getOneLineXml(line.text, line.aline, apool, reqOptions, commentCollector);
        
        lineManager.processLine(line.listLevel, line.listTypeName, lineContent);
    }

    return lineManager.finishAndReturnXml();
};


/*
 * _getOneLineXml
 * Returns an XML representation for a pad line
 * first it processes line attributes (if requested and if a linemarker exists)
 * then it processes the inline attributes
 * 
 */
var _getOneLineXml = function(text, attribs, apool, reqOptions, commentCollector) {
    // process line attributes
    var lineAttributes = [];
    var lineAttributeResult = _processLineAttributes(attribs, apool);
    
    var lineAttributesEnabled = reqOptions.lineattribs === true && lineAttributeResult.hasLineAttributes;
    if (lineAttributesEnabled) {
        lineAttributes = lineAttributeResult.lineAttributes;
    }
    
    // shift textString by one if line attributes are found (due to linemarker '*')
    var lineAttributeOffset = lineAttributesEnabled ? 1 : 0;
    var remainingText = text.substring(lineAttributeOffset);
    var remainingAttributes = Changeset.subattribution(attribs, lineAttributeOffset, text.length);
    
    // get inline xml
    var lineContentString = _getInlineXml(remainingText, remainingAttributes, apool, reqOptions.regex === true, commentCollector);

    // create line xml from inlinexml and line attributes
    return utils.createLineElement(lineAttributes, lineContentString);
}; // end _getOneLineXml


function _getInlineXml(text, attributeString, apool, regexEnabled, commentCollector) {
    var operationHandler = new OperationsToXmlTranslator(apool, DROPATTRIBUTES, commentCollector);
    var textIterator = Changeset.stringIterator(text);
    var xmlStringAssembler = Changeset.stringAssembler();
    
    var getNextAttributes = function(numberOfCharacters) {
        return Changeset.subattribution(attributeString, 0, numberOfCharacters);
    };
    
    /*
     * Process URIs
     */
    if (regexEnabled) {
        var urls = utils.findURLs(text);
        
        urls.forEach(function(urlData) {
            var startIndex = urlData[0];
            var url = urlData[1];

            var lineSegmentBeforeUrl = _getLineSegmentXml(getNextAttributes(startIndex), operationHandler, textIterator);
            var uriText = _getLineSegmentXml(getNextAttributes(url.length), operationHandler, textIterator);
            
            xmlStringAssembler.append(lineSegmentBeforeUrl.withMarkup);
            xmlStringAssembler.append('<matched-text key="uri" value="' + uriText.plainText + '">' + uriText.withMarkup + '</matched-text>');
        });
    }
    var lineSegment = _getLineSegmentXml(getNextAttributes(textIterator.remaining()), operationHandler, textIterator);
    
    xmlStringAssembler.append(lineSegment.withMarkup);

    var lineContentString = xmlStringAssembler.toString();
    return lineContentString;
}

/*
* getLineSegmentXml
* Gets text with length of 'numChars' starting from current position of lineIterator.
* Returns both, text with markup and plain text as literal object
* { withMarkup: ..., plainText: ... }
*
*/
function _getLineSegmentXml(attributeString, operationHandler, textIterator) {
   if (attributeString.length <= 0) {
       return {
           withMarkup: "",
           plainText:  ""
       };
   } else {
       var lineSegmentWithMarkup = "";
       var lineSegmentWithoutMarkup = "";

       operationHandler.reset();

       var opIterator = Changeset.opIterator(attributeString);

       // begin iteration over spans (=operations) in line segment
       while (opIterator.hasNext()) {
           var currentOp = opIterator.next();
           var opXml = operationHandler.getXml(currentOp, textIterator);
           //console.warn(opXml);
           lineSegmentWithMarkup += opXml.withMarkup;
           lineSegmentWithoutMarkup += opXml.plainText;
       } // end iteration over spans in line segment

       return {
           withMarkup: lineSegmentWithMarkup + operationHandler.getEndTagsAfterLastOp(),
           plainText:  lineSegmentWithoutMarkup
       };
   }
} // end getLineSegmentXml

function _processLineAttributes (attribs, apool) {
    var lineMarkerFound = false;
    var lineAttributes = [];

    // start lineMarker (lmkr) check
    var firstCharacterOfLineOpIterator = Changeset.opIterator(Changeset.subattribution(attribs, 0, 1));

    if (firstCharacterOfLineOpIterator.hasNext()) {
        var singleOperation = firstCharacterOfLineOpIterator.next();

        // iterate through attributes
        Changeset.eachAttribNumber(singleOperation.attribs, function (a) {
            lineAttributes.push([apool.numToAttrib[a][0], apool.numToAttrib[a][1]]);

            if (apool.numToAttrib[a][0] === "lmkr") {
                lineMarkerFound = true;
            }
        });
    }

    return {
        hasLineAttributes: lineMarkerFound,
        lineAttributes: lineAttributes
    };
}


/*
 * Define exports
 *
 */
exports.getPadXmlDocument = getPadXmlDocument;

