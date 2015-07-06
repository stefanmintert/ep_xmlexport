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
	var xmlescape = require("xml-escape");
	var commentsXml = require("./commentsXml.js");

	//var DROPATTRIBUTES = ["insertorder"]; // exclude attributes from export
	var DROPATTRIBUTES = [];


	/* ********************************************
	 * 	XML helper functions
	 */
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


	var _getXmlStartTagForEplAttribute = function(key, val) {

		return '<attribute key="' + key + '" value="' + val + '">';
	};

	var _getXmlEndTagForEplAttribute = function(key) {
		return '</attribute><!-- /' + key + ' -->';
	};





	/* ********************************************
	 * EPL specific functions
	 *
	 */


	/*
	 * Unfortunately Changeset.stringIterator does not reveal it's current index.
	 * This function calculates the index from the original string length
	 * and the remaining number of characters.
	 *
	 */
	var getIteratorIndex = function(stringIterator, stringLength) {
		return (stringLength - stringIterator.remaining());
	};




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
	};

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
	};



	/*
	 * analyzeLine
	 * Lists discovery
	 *
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



	/*
	 * operationHandler
	 *
	 * Handles the transformation of operations to XML
	 */

	var operationHandler = (function() {
		var ENTER = 1;
		var STAY = 2;
		var LEAVE = 0;

		var propVals = [false, false, false];
		var tags2close = [];

		var aNumMap, properties, attributePool, lineIterator;

		var _getPropVal = function(n) {
			return propVals[n];
		};

		var _setPropVal = function(n, val) {
			propVals[n] = val;
		};

		var _countPropVals = function() {
			return propVals.length;
		};

		var init = function(anMap, props, apool, lIterator) {
			propVals = [false, false, false];
			tags2close = [];

			aNumMap = anMap;
			properties = props;
			attributePool = apool;
			lineIterator = lIterator;
		};

		var getEndTagsAfterLastOp = function() {
			var tags2close = [];
			for (var n = _countPropVals() - 1; n >= 0; n--) {
				if (_getPropVal(n)) {
					tags2close.push(n);
					_setPropVal(n, false);
				}
			}

			return _getOrderedEndTags(tags2close, attributePool, properties);
		};


		/*
		 * getXml(operation)
		 *
		 * Transforms a given operation to XML.
		 *
		 */
		 var getXml = function(op) {
			var propChanged = false;
			var opTextWithMarkup = "";
			var opTextWithoutMarkup = "";

			Changeset.eachAttribNumber(op.attribs, function (a) {
				if (a in aNumMap) {
					var i = aNumMap[a]; // i = 0 => bold, etc.
					if (!propVals[i]) {
						propVals[i] = ENTER;
						propChanged = true;
					} else {
						propVals[i] = STAY;
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



				opTextWithMarkup = _getOrderedEndTags(tags2close, attributePool, properties);


				for (var l = 0; l < propVals.length; l++) {

					// If entering a new comment, select comment for later translation to XML
					if (propVals[l] === ENTER && properties[l] === "comment") {
                                                // TODO we have to do deal with this in another way
						//commentsXml.selectComment(attributePool.numToAttrib[l][1]);
					}

					if (propVals[l] === ENTER || propVals[l] === STAY) {
						openElements.unshift(l);
						var aKey = properties[l];
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
			 init: init,
			 getXml: getXml,
			 getEndTagsAfterLastOp: getEndTagsAfterLastOp
		 };

	})();


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
	function _getOrderedEndTags(tags2close, apool, props) {
		var orderedEndTagsString = "";
		for(var i=0; i < openElements.count(); i++) {
			for(var j=0;j<tags2close.length;j++) {
				if(tags2close[j] == openElements.get(i)) {
					openElements.shift();
					orderedEndTagsString += _getXmlEndTagForEplAttribute(props[tags2close[j]]);
					i--;
					break;
				}
			}
		}
		return orderedEndTagsString;
	}





	/* ********************************************
	 * Regexp analysis
	 *
	 */

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
	};




	/*
	 * Define exports
	 *
	 */
	exports.createLineElement = createLineElement;
	exports.getIteratorIndex = getIteratorIndex;
	exports.getPropertyNames = getPropertyNames;
	exports.populateAnumMap = populateAnumMap;
	exports.findURLs = findURLs;
	exports.analyzeLine = analyzeLine;
	exports.operationHandler = operationHandler;
	exports.openElements = openElements;

})();
