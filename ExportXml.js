var Changeset = require("ep_etherpad-lite/static/js/Changeset");
var padManager = require("ep_etherpad-lite/node/db/PadManager");
var throwIfError = require("ep_etherpad-lite/node_modules/async-stacktrace");
var commentsXml = require("./commentsXml.js");
var xmlescape = require("xml-escape");
var Line = require("./Line.js");
var OperationsToXmlTranslator = require("./OperationsToXmlTranslator");

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

    var lineMarkupManager = new Line.LineMarkupManager(reqOptions.lists === true);

    for (var i = 0; i < textLines.length; i++) {
        var line = new Line(attribLines[i], textLines[i], apool);

        // shift textString by one if line attributes are found (due to linemarker '*')
        var removeLinemarker      = reqOptions.lists  || (reqOptions.lineattribs && line.hasLineAttributes());
        // add lineattributes if there are any, but NOT if lists are enabled (maybe we decide to change this behaviour later)
        var lineAttributesEnabled = !reqOptions.lists  && reqOptions.lineattribs && line.hasLineAttributes();
        
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
    var operationsToXmlTranslator = new OperationsToXmlTranslator(apool, DROPATTRIBUTES, commentCollector);
    var textIterator = Changeset.stringIterator(text);
    var xmlStringAssembler = Changeset.stringAssembler();
    
    var _getNextAttributes = function(numberOfCharacters) {
        var from = text.length - textIterator.remaining();
        var to = numberOfCharacters ? from + numberOfCharacters : textIterator.remaining();
        return Changeset.subattribution(attributeString, from, to);
    };
    
    /*
     * Process URIs
     */
    if (regexEnabled) {
        var urlMatcher = new CustomMatcher(_getUrlRegex(), text);
        var match;
        while ((match = urlMatcher.next())) {
            var attributesBeforeUrl = _getNextAttributes(match.start);
            var lineSegmentBeforeUrl = _getLineSegmentXml(attributesBeforeUrl, operationsToXmlTranslator, textIterator);
            
            var attributesInUrl = _getNextAttributes(match.matchLength);
            var uriText = _getLineSegmentXml(attributesInUrl, operationsToXmlTranslator, textIterator);
            
            xmlStringAssembler.append(lineSegmentBeforeUrl.withMarkup);
            xmlStringAssembler.append('<matched-text key="uri" value="' + uriText.plainText + '">' + uriText.withMarkup + '</matched-text>');
        }
    }
    console.log("complete attribute string: "+ attributeString);
    var remainingAttributes = _getNextAttributes(textIterator.remaining());
    console.log("remainingAttributes: "+ remainingAttributes);
    var lineSegment = _getLineSegmentXml(remainingAttributes, operationsToXmlTranslator, textIterator);
    
    xmlStringAssembler.append(lineSegment.withMarkup);

    var lineContentString = xmlStringAssembler.toString();
    return lineContentString;
}

/*
* @param attributeString an epl attribute string
* @param operationHandler object that turns attributes to xml
* @param textIterator that has to be in sync with the attributeString
* Returns both, text with markup and plain text as literal object
* { withMarkup: ..., plainText: ... }
*
*/
function _getLineSegmentXml(attributeString, operationsToXmlTranslator, textIterator) {
   if (attributeString.length <= 0) {
       return {
           withMarkup: "",
           plainText:  ""
       };
   } else {
       var lineSegmentWithMarkup = "";
       var lineSegmentWithoutMarkup = "";

       operationsToXmlTranslator.reset();

       var opIterator = Changeset.opIterator(attributeString);

       // begin iteration over spans (=operations) in line segment
       while (opIterator.hasNext()) {
           var currentOp = opIterator.next();
           var opXml = operationsToXmlTranslator.getXml(currentOp, textIterator);
           //console.warn(opXml);
           lineSegmentWithMarkup += opXml.withMarkup;
           lineSegmentWithoutMarkup += opXml.plainText;
       } // end iteration over spans in line segment

       return {
           withMarkup: lineSegmentWithMarkup + operationsToXmlTranslator.getEndTagsAfterLastOp(),
           plainText:  lineSegmentWithoutMarkup
       };
   }
} // end getLineSegmentXml


var _getUrlRegex = function() {
    // copied from ACE
    var _REGEX_WORDCHAR = /[\u0030-\u0039\u0041-\u005A\u0061-\u007A\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\u0100-\u1FFF\u3040-\u9FFF\uF900-\uFDFF\uFE70-\uFEFE\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFDC]/;
    var _REGEX_URLCHAR = new RegExp('(' + /[-:@a-zA-Z0-9_.,~%+\/\\?=&#;()$]/.source + '|' + _REGEX_WORDCHAR.source + ')');
    var _REGEX_URL = new RegExp(/(?:(?:https?|s?ftp|ftps|file|smb|afp|nfs|(x-)?man|gopher|txmt):\/\/|mailto:)/.source + _REGEX_URLCHAR.source + '*(?![:.,;])' + _REGEX_URLCHAR.source, 'g');
    return _REGEX_URL;
};

/**
 * this is a convenience regex matcher that iterates through the matches 
 * and returns each start index and length
 * @param {RegExp} regex
 * @param {String} text
 */
var CustomMatcher = function(regex, text){
    var nextIndex = 0;
    var result = [];

    var execResult;
    while ((execResult = regex.exec(text))!== null) {
        result.push({
            start: execResult.index, 
            matchLength: execResult[0].length});
    }

    return {
        next: function(){
            return nextIndex < result.length ?
                result[nextIndex++] :
                null;
        }
    };
};


/*
 * Define exports
 *
 */
exports.getPadXmlDocument = getPadXmlDocument;

