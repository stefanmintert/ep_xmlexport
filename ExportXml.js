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
 * 
 * The LineMarkupManager cares for creating the correct markup for lines, line attributes and lists.
 * It keeps track of list levels and correctly closing list items.
 * It does not care for inline markup, it just includes it as a string.
 * 
 * Usage:
 * var lineMarkupManager = new LineMarkupManager(listsEnabled);
 * lineMarkupManager.processLine(line, inlineContent, lineAttributesEnabled);
 * var xml = lineMarkupManager.finishAndReturnXml();
 * 
 */
var LineMarkupManager = function(listsEnabled){
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
        _wrapWithLineElement: function(lineAttributes, lineContentString) {
            var lineStartTag = '<line';
            for (var i = 0; i < lineAttributes.length; i++) {
                lineStartTag += ' ';
                lineStartTag += lineAttributes[i][0];
                lineStartTag += '="';
                lineStartTag += lineAttributes[i][1];
                lineStartTag += '"';
            }
            lineStartTag += ">";
            var lineEndTag = '</line>';

            return lineStartTag + lineContentString + lineEndTag;
        },
        finishAndReturnXml: function() {
            for (var k = lists.length - 1; k >= 0; k--) {
                xmlPieces.push("\n</list>\n"); // number or bullet
            }
            return xmlPieces.join("");
        },
        processLine: function(line, lineContent, lineAttributesEnabled) {
            var lineAttributes = lineAttributesEnabled ? line.getLineAttributes() : [];
            var lineElement = this._wrapWithLineElement(lineAttributes, lineContent);
            //If we are inside a list: wrap with list elements
            if (line.getListLevel() && listsEnabled) {
                this._startListItem(line.getListLevel(), line.getListType(), lineElement);
            } else { //outside any list
                this._closeListItemsIfNecessary();
                this._pushContent(lineElement);
            }
        }
    };
};


var Line = function(aline, text, apool){
    var line = {};
    function _analyzeLists () {
        // identify list
        var lineMarker = false;
        line.listLevel = 0;
        if (aline) {
            var opIter = Changeset.opIterator(aline);
            if (opIter.hasNext()) {
                var listType = Changeset.opAttributeValue(opIter.next(), 'list', apool);

                if (listType) {
                    lineMarker = true;
                    listType = /([a-z]+)([12345678])/.exec(listType);
                    if (listType) {
                        line.listTypeName = listType[1];
                        line.listLevel = Number(listType[2]);
                    }
                }
            }
        }
        if (lineMarker) {
            // line text without linemarker ("*")
            line.text = text.substring(1);
            line.aline = Changeset.subattribution(aline, 1);
        } else {
            line.text = text;
            line.aline = aline;
        }

        return line;
    }
    
    function _analyzeLineAttributes () {
        var lineMarkerFound = false;
        var lineAttributes = [];

        // start lineMarker (lmkr) check
        var firstCharacterOfLineOpIterator = Changeset.opIterator(Changeset.subattribution(aline, 0, 1));

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
        
        line.hasLineAttributes = lineMarkerFound;
        line.lineAttributes = lineAttributes;
    }
    
    _analyzeLists();
    _analyzeLineAttributes();
    
    return {
        getPlaintext: function(removeLinemarker){
            return removeLinemarker ? line.text : text;
        },
        getAttributeString: function(removeLineAttributes){
            return removeLineAttributes ? line.aline : aline;
        },
        hasLineAttributes: function(){
            return line.hasLineAttributes;
        },
        getLineAttributes: function() {
            return line.lineAttributes;
        },
        hasList: function(){
            return line.listLevel > 0;
        },
        getListLevel: function(){
            return line.listLevel;
        },
        getListType: function(){
            return line.listTypeName;
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

    var lineMarkupManager = new LineMarkupManager(reqOptions.lists === true);

    for (var i = 0; i < textLines.length; i++) {
        var line = new Line(attribLines[i], textLines[i], apool);
        
        // get line attributes
        var lineAttributesEnabled = reqOptions.lineattribs === true && line.hasLineAttributes();
        
        // shift textString by one if line attributes are found (due to linemarker '*')
        var removeLinemarker = reqOptions.lists === true || lineAttributesEnabled;
        
        // get inline content
        var inlineContent = _getInlineXml(
                line.getPlaintext(removeLinemarker), line.getAttributeString(removeLinemarker), 
                apool, reqOptions.regex === true, commentCollector);
        
        // wrap inline content with markup (line, lists)
        lineMarkupManager.processLine(line, inlineContent, lineAttributesEnabled);
    }

    return lineMarkupManager.finishAndReturnXml();
};


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

/*
 * Define exports
 *
 */
exports.getPadXmlDocument = getPadXmlDocument;

