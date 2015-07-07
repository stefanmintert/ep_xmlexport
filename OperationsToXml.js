
var Changeset = require("ep_etherpad-lite/static/js/Changeset");
var xmlescape = require("xml-escape");
/*
 * operationHandler
 *
 * Handles the transformation of operations to XML
 */
var OperationsToXmlTranslator = function(propertyNames, apool, lIterator, dropAttributes) {
    
    /*
     * openElements
     *
     * keeps track of opened, not yet closed elements.
     *
     */
    var openElements = (function() {
        var openElems = [];

        var init = function() {
            openElems = [];
        };


        var count = function() {
            return openElems.length;
        };

        var get = function(n) {
            return openElems[n];
        };

        var shift = function() {
            return openElems.shift();
        };

        var unshift = function(val) {
            return openElems.unshift(val);
        };

        return {
            init: init,
            count: count,
            get: get,
            shift: shift,
            unshift: unshift
        };
    })();



    var ENTER = 1;
    var STAY = 2;
    var LEAVE = 0;

    var propVals = [false, false, false];
    var tags2close = [];
    var dropAttributeIndexes = dropAttributes.map(function(attribute){
        return propertyNames.indexOf(attribute);
    });
    

    var attributePool = apool, 
        lineIterator = lIterator;

    var _getPropVal = function(n) {
        return propVals[n];
    };

    var _setPropVal = function(n, val) {
        propVals[n] = val;
    };

    var _countPropVals = function() {
        return propVals.length;
    };

    var _getXmlStartTagForEplAttribute = function(key, val) {
        return '<attribute key="' + key + '" value="' + val + '">';
    };

    var _getXmlEndTagForEplAttribute = function(key) {
        return '</attribute><!-- /' + key + ' -->';
    };

    /*
     * _getOrderedEndTags()
     *
     * Get all end-tags for all open elements in the current line.
     * The function keeps the proper order of opened elements.
     * (Which might be required if we should switch to different
     * element types in the future; as long as everything is
     * <attribute>, order doesn't matter)
     *
     */
    function _getOrderedEndTags(tags2close) {
        var orderedEndTagsString = "";
        for (var i=0; i < openElements.count(); i++) {
            for (var j=0;j<tags2close.length;j++) {
                if (tags2close[j] === openElements.get(i)) {
                    openElements.shift();
                    orderedEndTagsString += _getXmlEndTagForEplAttribute(propertyNames[tags2close[j]]);
                    i--;
                    break;
                }
            }
        }
        return orderedEndTagsString;
    }


    var reset = function() {
        propVals = [false, false, false];
        tags2close = [];
    };


    var getEndTagsAfterLastOp = function() {
        var tags2close = [];
        for (var n = _countPropVals() - 1; n >= 0; n--) {
            if (_getPropVal(n)) {
                tags2close.push(n);
                _setPropVal(n, false);
            }
        }

        return _getOrderedEndTags(tags2close);
    };


    /*
     * getXml(operation)
     *
     * Transforms a given operation to XML.
     *
     */
     var getXml = function(op, commentCollector) {
        var propChanged = false;
        var opTextWithMarkup = "";

        Changeset.eachAttribNumber(op.attribs, function (attributeIndex) {
            if (dropAttributeIndexes.indexOf(attributeIndex) < 0) {
                if (!propVals[attributeIndex]) {
                    propVals[attributeIndex] = ENTER;
                    propChanged = true;
                } else {
                    propVals[attributeIndex] = STAY;
                }
            }
        });

        for (var j = 0; j < propVals.length; j++) {
            if (propVals[j] === true) {
                propVals[j] = LEAVE;
                propChanged = true;
            } else if (propVals[j] === STAY) {
                propVals[j] = true; // set it back
            }
        }

        // now each member of propVal is in {false,LEAVE,ENTER,true}
        // according to what happens at start of span
        if (propChanged) {
            // leaving bold (e.g.) also leaves italics, etc.
            var left = false;

            // check if ANY prop has to be left
            for (var i = 0; i < propVals.length; i++) {
                var v = propVals[i];
                if (!left) {
                    if (v === LEAVE) {
                        left = true;
                    }
                }
            }

            // if any prop was left, close and re-open the others that are active (value 'true')
            if (left) {
                for (var m = 0; m < propVals.length; m++) {
                    var val = propVals[m];
                    if (val === true) {
                        propVals[m] = STAY; // tag will be closed and re-opened
                    }
                }
            }

            tags2close = [];

            for (var k = propVals.length - 1; k >= 0; k--) {
                if (propVals[k] === LEAVE) {
                    tags2close.push(k);
                    propVals[k] = false;
                } else if (propVals[k] === STAY) {
                    tags2close.push(k);
                }
            }



            opTextWithMarkup = _getOrderedEndTags(tags2close);


            for (var l = 0; l < propVals.length; l++) {

                // If entering a new comment, select comment for later translation to XML
                if (propVals[l] === ENTER && propertyNames[l] === "comment") {
                    commentCollector.add(attributePool.numToAttrib[l][1]);
                }

                if (propVals[l] === ENTER || propVals[l] === STAY) {
                    openElements.unshift(l);
                    var aKey = propertyNames[l];
                    var aVal = attributePool.numToAttrib[l][1];
                    opTextWithMarkup += _getXmlStartTagForEplAttribute(aKey, aVal);
                    propVals[l] = true;
                }
            }
            // propVals is now all {true,false} again
        } // end if (propChanged)
        var chars = op.chars;
        if (op.lines) {
            chars--; // exclude newline at end of line, if present
        }

        var s = xmlescape(lineIterator.take(chars));

        return {
            withMarkup: opTextWithMarkup + s,
            plainText: s
        };
    };

    return {
        reset: reset,
        getXml: getXml,
        getEndTagsAfterLastOp: getEndTagsAfterLastOp
    };
};


module.exports = OperationsToXmlTranslator;
