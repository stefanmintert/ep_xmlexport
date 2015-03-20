/*jshint loopfunc: true */
/* TODO refactor to be able to remove the above directive */


/*
 * WARNING: exportUtils.js is not a reasonable CommonJS module, with
 * functions for a specific purpose.
 *
 * Up to now it's just a file to store some randomly collected
 * function which formerly were part of ExportXml.js.
 * The purpose of this file is to make ExportXml.js shorter and
 * easier to understand.
 *
 * Future re-factoring might remove this file and replace it with
 * one or more other modules.
 *
 */




(function() {
    var Changeset = require("ep_etherpad-lite/static/js/Changeset");

    //var DROPATTRIBUTES = ["insertorder"]; // exclude attributes from export
    var DROPATTRIBUTES = [];


    var createLineElement = function(lineAttributes, lineContentString, lmkr) {
        var lineStartTag = '<line';

        if (lmkr) {
          for (var i = 0; i < lineAttributes.length; i=i+1) {
                  lineStartTag += ' ';
                  lineStartTag += lineAttributes[i][0];
                  lineStartTag += '="';
                  lineStartTag += lineAttributes[i][1];
                  lineStartTag += '"';
          }
        }
        lineStartTag += ">";
        var lineEndTag = '</line>';


        return lineStartTag + lineContentString + lineEndTag;
    };


    var getXmlStartTagForEplAttribute = function(apool, props, i) {
  	  var startTag = '<attribute key="'
		 				+ props[i]
		 				+ '" value="'
		 				+ apool.numToAttrib[i][1]
		 				+ '">';

	     return startTag;
    }

    var getXmlEndTagForEplAttribute = function(apool, props, i) {
  	  return '</attribute><!-- /' + props[i] + ' -->';
    }

    /*
     * Unfortunately Changeset.stringIterator does not reveal it's current index.
     * This function calculates the index from the original string length
     * and the remaining number of characters.
     *
     */
    var getIteratorIndex = function(stringIterator, stringLength) {
            return (stringLength - stringIterator.remaining());
    }


    /*
     * Collect all property names (=attribute names) which are used in apool
     */
    var getPropertyNames = function(apool) {
    	var propsArray = [];

	    for (var propName in apool.numToAttrib) {
	       if (apool.numToAttrib.hasOwnProperty(propName)) {
	    	   propsArray.push(apool.numToAttrib[propName][0]);
	       }
	    }
	    return propsArray;
    }

    var populateAnumMap = function(propNames) {
    	var anumMap = {};

	    /*
	     * anumMap maps the attribute numbers to their index in the props array.
	     * This is legacy code. In our case both numbers should always be the same.
	     * TODO: do we need anumMap any longer? if not, remove anumMap from the entire code.
	     */
    	propNames.forEach(function (propName, i) {
	        if (DROPATTRIBUTES.indexOf(propName) < 0) { // Attribute shall be dropped
	            anumMap[i] = i;
	        }
	    });

	    return anumMap;
    }



    // returns null if no URLs, or [[startIndex1, url1], [startIndex2, url2], ...]
    var findURLs = function (text) {
    	 // copied from ACE
        var _REGEX_WORDCHAR = /[\u0030-\u0039\u0041-\u005A\u0061-\u007A\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\u0100-\u1FFF\u3040-\u9FFF\uF900-\uFDFF\uFE70-\uFEFE\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFDC]/;
        var _REGEX_SPACE = /\s/;
        var _REGEX_URLCHAR = new RegExp('(' + /[-:@a-zA-Z0-9_.,~%+\/\\?=&#;()$]/.source + '|' + _REGEX_WORDCHAR.source + ')');
        var _REGEX_URL = new RegExp(/(?:(?:https?|s?ftp|ftps|file|smb|afp|nfs|(x-)?man|gopher|txmt):\/\/|mailto:)/.source + _REGEX_URLCHAR.source + '*(?![:.,;])' + _REGEX_URLCHAR.source, 'g');


        _REGEX_URL.lastIndex = 0;
        var urls = null;
        var execResult;
        while ((execResult = _REGEX_URL.exec(text))) {
          urls = (urls || []);
          var startIndex = execResult.index;
          var url = execResult[0];
          urls.push([startIndex, url]);
        }

        return urls;
    }


    /*
    *
    * TODO outsource this function
    */
   var analyzeLine = function (text, aline, apool, reqOptions) {

       var line = {};

       // identify list
       var lineMarker = 0;
       line.listLevel = 0;
       if (aline) {
         var opIter = Changeset.opIterator(aline);
         if (opIter.hasNext() && (reqOptions.lists === true) ) {
           var listType = Changeset.opAttributeValue(opIter.next(), 'list', apool);

           if (listType) {
             lineMarker = 1;
             listType = /([a-z]+)([12345678])/.exec(listType);
             if (listType) {
               line.listTypeName = listType[1];
               line.listLevel = Number(listType[2]);
             }
           }
         }
       }
       if (lineMarker) {
         line.text = text.substring(1);
         line.aline = Changeset.subattribution(aline, 1);
       } else {
         line.text = text;
         line.aline = aline;
       }

       return line;
   };


    /*
     * Define exports
     *
     */
    exports.createLineElement = createLineElement;
    exports.getXmlStartTagForEplAttribute = getXmlStartTagForEplAttribute;
    exports.getXmlEndTagForEplAttribute = getXmlEndTagForEplAttribute;
    exports.getIteratorIndex = getIteratorIndex;
    exports.getPropertyNames = getPropertyNames;
    exports.populateAnumMap = populateAnumMap;
    exports.findURLs = findURLs;
    exports.analyzeLine = analyzeLine;
    /*
    exports. = ;
    exports. = ;
	*/

})();
