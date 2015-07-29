var Changeset = require("ep_etherpad-lite/static/js/Changeset");


var LIST_ATTRIBUTE_NAMES = ['list', 'start'];
var LINEMARKER_ATTRIBUTE_NAMES = ['lmkr', 'insertorder'];

function _isListAttribute(attributeName) {
    return LIST_ATTRIBUTE_NAMES.indexOf(attributeName) > -1;
};

function _isLinemarkerAttribute(attributeName) {
    return LINEMARKER_ATTRIBUTE_NAMES.indexOf(attributeName) > -1;
};

/**
 * Representation of an EPL attributed line, 
 * provides access to some line analysis results (line attributes, list properties)
 * @param {type} rawAttributeString the attributeString as returned by EPL's 
 * Changeset.splitAttributionLines(atext.attribs, atext.text)
 * @param {type} rawText the plain line text
 * @param {type} apool the apool object that maps the operators in the attribute string to attribute names
 */
var Line = function(rawAttributeString, rawText, apool){
    var extractedText = "";
    var hasLineAttributes = false;
    var lineAttributes = [];
    var inlineAttributeString;
    var listLevel = 0;
    var listTypeName;
    
    
    function _analyzeLists () {
        // identify list
        listLevel = 0;
        if (rawAttributeString) {
            var opIter = Changeset.opIterator(rawAttributeString);
            if (opIter.hasNext()) {
                var listType = Changeset.opAttributeValue(opIter.next(), 'list', apool);

                if (listType) {
                    var listTypeParts = /([a-z]+)([12345678])/.exec(listType);
                    if (listTypeParts) {
                        listTypeName = listTypeParts[1];
                        listLevel = Number(listTypeParts[2]);
                    }
                }
            }
        }
    }
    
    function _analyzeLineAttributes () {
        var lineMarkerFound = false;

        // start lineMarker (lmkr) check
        var firstCharacterOfLineOpIterator = Changeset.opIterator(Changeset.subattribution(rawAttributeString, 0, 1));

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
        
        hasLineAttributes = lineMarkerFound;
        
        if (hasLineAttributes) {
            // line text without linemarker ("*")
            extractedText = rawText.substring(1);
            inlineAttributeString = Changeset.subattribution(rawAttributeString, 1);
        } else {
            extractedText = rawText;
            inlineAttributeString = rawAttributeString;
        }
    }
    
    _analyzeLists();
    _analyzeLineAttributes();
    
    var _attributeStringWithoutListAttributes = function(attributeString) {
        var opIterator = Changeset.opIterator(attributeString);
        var filteredAttributeString = "";
        
        while (opIterator.hasNext()) {
            var nextOperation = opIterator.next();
            var filteredAttributes = Changeset.filterAttribNumbers(nextOperation.attribs, function (a) {
                return !_isListAttribute(apool.numToAttrib[a][0]);
            });
            nextOperation.attribs = filteredAttributes;
            filteredAttributeString += Changeset.opString(nextOperation);
        }
        return filteredAttributeString;
    };
    
    
    var hasList = function(){
        return listLevel > 0;
    };
    
    var _withoutListAttributes = function(attributes) {
        return attributes.filter(function(item) {
            return !_isListAttribute(item[0]);
        });
    };
    
    var _withoutLmkrAttributes = function(attributes) {
        return attributes.filter(function(item) {
            return !_isLinemarkerAttribute(item[0]);
        });
    };
    
    var _hasNonlistLineAttributes = function() {
        return _withoutListAttributes(_withoutLmkrAttributes(lineAttributes)).length > 0;
    };
    
    /**
     * splits the line into line attributes and the remaining plain text and inline attributes
     * depending on the given parameters 
     * @param {Boolean} listsEnabled if the client sent the parameter lists=true
     * @param {Boolean} lineAttributesEnabled if the client sent the parameter lineattribs=true
     * @return {lineAttributes: Array, inlineAttributeString: String, inlinePlaintext: String}
     */
    var extractLineAttributes = function(listsEnabled, lineAttributesEnabled) {
        if ((!hasList() && !hasLineAttributes) || (!listsEnabled && !lineAttributesEnabled)) {
                return {
                    lineAttributes: [],
                    inlineAttributeString: rawAttributeString,
                    inlinePlaintext: rawText
                };
            }
            
            if (listsEnabled && !lineAttributesEnabled) {
                if (hasList() && _hasNonlistLineAttributes()) {
                    return {
                        lineAttributes: [],
                        inlineAttributeString: _attributeStringWithoutListAttributes(rawAttributeString),
                        inlinePlaintext: rawText
                    };
                } else if (hasList() && !_hasNonlistLineAttributes()){
                    return {
                        lineAttributes: [],
                        inlineAttributeString: inlineAttributeString,
                        inlinePlaintext: extractedText
                    };
                } else if (!hasList() && hasLineAttributes){
                    return {
                        lineAttributes: [],
                        inlineAttributeString: rawAttributeString,
                        inlinePlaintext: rawText
                    };
                } else {
                    console.error("Plugin error: it seems the developer missed a case here.");
                }
            } else if (listsEnabled && lineAttributesEnabled) {
                if (_hasNonlistLineAttributes()) {
                    return {
                        lineAttributes: _withoutListAttributes(lineAttributes),
                        inlineAttributeString: inlineAttributeString,
                        inlinePlaintext: extractedText
                    };
                } else {
                    return {
                        lineAttributes: [],
                        inlineAttributeString: inlineAttributeString,
                        inlinePlaintext: extractedText
                    };
                }
            } else if (!listsEnabled && lineAttributesEnabled) {
                return {
                    lineAttributes: lineAttributes,
                    inlineAttributeString: inlineAttributeString,
                    inlinePlaintext: extractedText
                };
            } else {
                console.error("Plugin error: it seems the developer missed a case here.");
            }
    };
    
    
    return {
        getPlaintext: function(removeLinemarker){
            return removeLinemarker ? extractedText : rawText;
        },
        getAttributeString: function(removeLineAttributes){
            return removeLineAttributes ? inlineAttributeString : rawAttributeString;
        },
        hasLineAttributes: function(){
            return hasLineAttributes;
        },
        getLineAttributes: function() {
            return lineAttributes;
        },
        extractLineAttributes: extractLineAttributes,
        hasList: hasList,
        getListLevel: function(){
            return listLevel;
        },
        getListType: function(){
            return listTypeName;
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
        processLine: function(line, lineAttributes, lineContent) {
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