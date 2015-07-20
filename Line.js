var Changeset = require("ep_etherpad-lite/static/js/Changeset");

/**
 * Representation of an EPL attributed line, 
 * provides access to some line analysis results (line attributes, list properties)
 * @param {type} aline the attributeString as returned by EPL's 
 * Changeset.splitAttributionLines(atext.attribs, atext.text)
 * @param {type} text the plain line text
 * @param {type} apool the apool object that maps the operators in the attribute string to attribute names
 */
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
                    var listTypeParts = /([a-z]+)([12345678])/.exec(listType);
                    if (listTypeParts) {
                        line.listTypeName = listTypeParts[1];
                        line.listLevel = Number(listTypeParts[2]);
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
Line.LineMarkupManager = function(listsEnabled, serializer){
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
                xmlPieces.push(serializer.startList(listTypeName) + serializer.startItem(), lineContent); // number or bullet
            } else { //means we are getting closer to the lowest level of indentation
                while (whichList < lists.length - 1) {
                    xmlPieces.push(serializer.endItem() + serializer.endList()); // number or bullet
                    lists.length--;
                }
                xmlPieces.push(serializer.endItem() + serializer.startItem(), lineContent);
            }
        },
        _closeListItemsIfNecessary: function() {
            //if was in a list: close it before
            while (lists.length > 0) {
                xmlPieces.push(serializer.endItem() + serializer.endList()); // number or bullet
                lists.length--;
            }
        },
        _pushContent: function(lineContent) {
            xmlPieces.push(lineContent + "\n");
        },
        _wrapWithLineElement: function(lineAttributes, lineContentString) {
            var lineStartTag = serializer.startLine(lineAttributes);
            var lineEndTag = serializer.endLine();

            return lineStartTag + lineContentString + lineEndTag;
        },
        finishAndReturnXml: function() {
            for (var k = 0; k < lists.length; k++) {
                if (k === 0) {
                    xmlPieces.push(serializer.endItem());
                }
                xmlPieces.push(serializer.endList()); // number or bullet
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


module.exports = Line;