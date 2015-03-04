/*jshint loopfunc: true */
/* TODO refactor to be able to remove the above directive */


(function() {
	var Changeset = require("ep_etherpad-lite/static/js/Changeset");
	var padManager = require("ep_etherpad-lite/node/db/PadManager");
	var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");

	//var DROPATTRIBUTES = ["insertorder"]; // exclude attributes from export
	var DROPATTRIBUTES = []; 

	
	
	
    function getXmlStartTagForEplAttribute(apool, props, i) {
  	  var startTag = '<attribute key="'
		 				+ props[i]
		 				+ '" value="'
		 				+ apool.numToAttrib[i][1]
		 				+ '">';
  	  
	     return startTag;
    }

    function getXmlEndTagForEplAttribute(apool, props, i) {
  	  return '</attribute>';
    }
	      
    
    
	
	var getPadXml = function (pad, reqOptions, callback) {
	    var atext, xml;
		var revNum = reqOptions.revision;


	    if (revNum) {
	          pad.getInternalRevisionAText(revNum, function (err, revisionAtext) {
		        if (ERR(err, callback)) {
		        	atext = pad.atext;
		        } else {
		        	atext = revisionAtext;
		        }

		        xml = getXmlFromAtext(pad, atext, reqOptions);
			    callback(null, xml);
		      });
	    } else {
		  atext = pad.atext;
		  xml = getXmlFromAtext(pad, atext, reqOptions);
		  callback(null, xml);
		}
	    
	    
	};
	
	/*
	 * Unfortunately Changeset.stringIterator does not reveal it's current index.
	 * This function calculates the index from the original string length
	 * and the remaining number of characters.
	 * 
	 */
	var getIteratorIndex = function(stringIterator, stringLength) {
		return (stringLength - stringIterator.remaining());
	}

	
	var getXmlFromAtext = function (pad, atext, reqOptions) {
	    var apool = pad.pool;
	    var textLines = atext.text.slice(0, -1).split('\n');
	    var attribLines = Changeset.splitAttributionLines(atext.attribs, atext.text);

	    var props = [];
	    var anumMap = {};


	    function getLineXml(text, attribs, apool) {
                var lmkr = false;
                var lineAttributes = [];
                // Use order of tags (b/i/u) as order of nesting, for simplicity
                // and decent nesting.  For example,
                // <b>Just bold<b> <b><i>Bold and italics</i></b> <i>Just italics</i>
                // becomes
                // <b>Just bold <i>Bold and italics</i></b> <i>Just italics</i>
                var xmlStringAssembler = Changeset.stringAssembler();

                var openTags = [];
                var urls;
                var textIterator = Changeset.stringIterator(text);

                /*
                 * getXmlForLineSpan 
                 * Gets text with length of 'numChars' starting from index 'fromIdx'.
                 * Returns both, text with markup and plain text as literal object
                 * { withMarkup: ..., plainText: ... } 
                 *  
                 */
                function getXmlForLineSpan(lineIterator, lineLength, numChars) {
                    var propVals = [false, false, false];
                    var ENTER = 1;
                    var STAY = 2;
                    var LEAVE = 0;

                    var tags2close = [];
                    var nextCharacters = "";
                    var nextPlainCharacters = "";

                    var fromIdx = getIteratorIndex(lineIterator, lineLength); 

                    console.log("================= getXmlForLineSpan: FromIdx: " + fromIdx + "; length: "+ numChars);

                    if (numChars <= 0) {
                        return {
                            withMarkup: "",
                            plainText:  ""
                        };
                    }

                    var opIterator = Changeset.opIterator(Changeset.subattribution(attribs, fromIdx, fromIdx + numChars));


                    var handleOp = function(op) {
                        var propChanged = false;
                        Changeset.eachAttribNumber(op.attribs, function (a) {
                          if (a in anumMap) {
                            var i = anumMap[a]; // i = 0 => bold, etc.
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
                          for (var i = 0; i < propVals.length; i++) {
                            var v = propVals[i];
                            if (!left) {
                              if (v === LEAVE) {
                                left = true;
                              }
                            } else {
                              if (v === true) {
                                propVals[i] = STAY; // tag will be closed and re-opened
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

                          nextCharacters += getOrderedEndTags(tags2close);


                          for (var l = 0; l < propVals.length; l++) {
                            if (propVals[l] === ENTER || propVals[l] === STAY) {
                                openTags.unshift(l);
                                nextCharacters += getXmlStartTagForEplAttribute(apool, props, l);
                                propVals[l] = true;
                            }
                          }
                          // propVals is now all {true,false} again
                        } // end if (propChanged)
                        var chars = op.chars;
                        if (op.lines) {
                          chars--; // exclude newline at end of line, if present
                        }

                        var s = lineIterator.take(chars);

                        nextCharacters += s;
                        nextPlainCharacters += s;
                    };

                    console.log("Status propVals: " + JSON.stringify(propVals) + "; tags2close: " + JSON.stringify(tags2close) + ";"
                            + " nextCharacters: " + nextCharacters + "; nextPlainCharacters: " + nextPlainCharacters);

                    while (opIterator.hasNext()) {
                      var currentOp = opIterator.next();
                      handleOp(currentOp);

                      console.log("Status propVals: " + JSON.stringify(propVals) + "; tags2close: " + JSON.stringify(tags2close) + ";");
                      console.log("nextCharacters: " + nextCharacters + "; nextPlainCharacters: " + nextPlainCharacters);
                    } // end iteration over spans in line

                    tags2close = [];
                    for (var n = propVals.length - 1; n >= 0; n--) {
                      if (propVals[n]) {
                        tags2close.push(n);
                        propVals[n] = false;
                      }
                    }

                    nextCharacters += getOrderedEndTags(tags2close);

                    console.log("================= getXmlForLineSpan: Return withMarkup: " + nextCharacters + "; plainText: "+ nextPlainCharacters);

                    return {
                        withMarkup: nextCharacters,
                        plainText:  nextPlainCharacters
                    }
                } // end getXmlForLineSpan

                /*
                 * getOrderedEndTags()
                 * 
                 * Get all end-tags for all open elements in the current line.
                 * The function keeps the proper order of opened elements.
                 * (Which might be required if we should switch to different
                 * element types in the future; as long as everything is
                 * <attribute>, order doesn't matter)
                 * 
                 */
                function getOrderedEndTags(tags2close) {
                    var orderedEndTagsString = "";

                          for(var i=0;i<openTags.length;i++) {
                            for(var j=0;j<tags2close.length;j++) {
                              if(tags2close[j] == openTags[i]) {
                                        openTags.shift();
                                        orderedEndTagsString += getXmlEndTagForEplAttribute(apool, props, tags2close[j]); 
                                i--;
                                break;
                              }
                            }
                          }
                                return orderedEndTagsString;
                        }
		      
	    
                /*
                 * Collect all property names (=attribute names) which are used in apool
                 */

                for (var propName in apool.numToAttrib) {
                    if (apool.numToAttrib.hasOwnProperty(propName)) {
                        props.push(apool.numToAttrib[propName][0]);
                    }
                }  

                /*
                 * anumMap maps the attribute numbers to their index in the props array.
                 * This is legacy code. In our case both numbers should always be the same.
                 * TODO: do we need anumMap anylonger? if not, remove anumMap from the entire code.
                 */
                props.forEach(function (propName, i) {
                      if (DROPATTRIBUTES.indexOf(propName) < 0) { // Attribute shall be dropped
                              anumMap[i] = i;
                      }
                });

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
                  urls = _findURLs(text);
                }

                if (urls) {
                  urls.forEach(function (urlData) {
                    var startIndex = urlData[0];
                    var url = urlData[1];
                    var urlLength = url.length;


                    xmlStringAssembler.append(getXmlForLineSpan(textIterator, text.length, startIndex - getIteratorIndex(textIterator, text.length)).withMarkup);

                    var uriText = getXmlForLineSpan(textIterator, text.length, urlLength);

                    xmlStringAssembler.append('<matched-text key="uri" value="' + uriText.plainText + '">' + uriText.withMarkup + '</matched-text>');
                  });
                }
	      
	      
	      
                xmlStringAssembler.append(getXmlForLineSpan(textIterator, text.length, textIterator.remaining()).withMarkup);



                // replace &, _
                var lineContentString = xmlStringAssembler.toString().replace(/\&/g, '\&amp;');

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
              
                return createLineElement(lineAttributes, lineContentString, lmkr);
	      
	      
	    } // end getLineXml

	    
	    
	    var pieces = [];

	    // Need to deal with constraints imposed on HTML lists; can
	    // only gain one level of nesting at once, can't change type
	    // mid-list, etc.
	    // People might use weird indenting, e.g. skip a level,
	    // so we want to do something reasonable there.  We also
	    // want to deal gracefully with blank lines.
	    // => keeps track of the parents level of indentation
	    var lists = []; // e.g. [[1,'bullet'], [3,'bullet'], ...]
	    for (var i = 0; i < textLines.length; i++) {
	      var line = _analyzeLine(textLines[i], attribLines[i], apool, reqOptions);
	      var lineContent = getLineXml(line.text, line.aline, apool);    
	      
	      if (line.listLevel && (reqOptions.lists === true))//If we are inside a list
	      {
	        // do list stuff
	        var whichList = -1; // index into lists or -1
	        if (line.listLevel)
	        {
	          whichList = lists.length;
	          for (var j = lists.length - 1; j >= 0; j--)
	          {
	            if (line.listLevel <= lists[j][0])
	            {
	              whichList = j;
	            }
	          }
	        }

	        if (whichList >= lists.length)//means we are on a deeper level of indentation than the previous line
	        {
	          lists.push([line.listLevel, line.listTypeName]);
	          pieces.push("\n"+(new Array((line.listLevel-1)*4)).join(' ')+"<list type='" + line.listTypeName + "'>\n"+(new Array(line.listLevel*4)).join(' ')+"<item>", lineContent || "\n", '</item>'); // number or bullet
	        }

	        else//means we are getting closer to the lowest level of indentation
	        {
	          while (whichList < lists.length - 1)
	          {
	            pieces.push("\n"+(new Array((line.listLevel-1)*4)).join(' ')+"</list>"); // number or bullet
	            lists.length--;
	          }
	          pieces.push("\n"+(new Array(line.listLevel*4)).join(' ')+"<item>", lineContent || "\n", '</item>');
	        }
	      }
	      else//outside any list
	      {
	        while (lists.length > 0)//if was in a list: close it before
	        {
	          pieces.push("\n"+(new Array((lists.length-1)*4)).join(' ')+"</list>\n"); // number or bullet
	          lists.length--;
	        }      
	        pieces.push(lineContent, "\n");
	      }    
	    }
	    
	    for (var k = lists.length - 1; k >= 0; k--)
	    {
	      pieces.push("\n</list>\n"); // number or bullet
	    }

	    return pieces.join("");
	};

        /* 
         * 
         * TODO outsource this function
         */
	var _analyzeLine = function (text, aline, apool, reqOptions)
	{
		
	    var line = {};

	    // identify list
	    var lineMarker = 0;
	    line.listLevel = 0;
	    if (aline)
	    {
	      var opIter = Changeset.opIterator(aline);
	      if (opIter.hasNext() && (reqOptions.lists === true) ) {
	        var listType = Changeset.opAttributeValue(opIter.next(), 'list', apool);

	        if (listType)
	        {
	          lineMarker = 1;
	          listType = /([a-z]+)([12345678])/.exec(listType);
	          if (listType)
	          {
	            line.listTypeName = listType[1];
	            line.listLevel = Number(listType[2]);
	          }
	        }
	      }
	    }
	    if (lineMarker)
	    {
	      line.text = text.substring(1);
	      line.aline = Changeset.subattribution(aline, 1);
	    }
	    else
	    {
	      line.text = text;
	      line.aline = aline;
	    }

	    return line;
	};
	
	
	
	/*
	 * getPadXmlDocument
	 * Get a well-formed XML Document for a given pad.
	 * 
	 * Wraps the line by line XML representing the pad content 
	 * in a root element and prepends an XML declaration
	 * 
	 */
	var getPadXmlDocument = function(padId, reqOptions, callback) {
		
		  padManager.getPad(padId, function (err, pad)
		  {
		    if(ERR(err, callback)) return;
		
		    getPadXml(pad, reqOptions, function (err, xml) {
		      if(ERR(err, callback)) return;
		      callback(null, '<?xml version="1.0"?>\n<pad>\n' + xml + '\n</pad>');
		    });
		  });
	};


	/*
	 * Define exports
	 * 
	 */
	exports.getPadXmlDocument = getPadXmlDocument; 

	
})();





// copied from ACE
var _REGEX_WORDCHAR = /[\u0030-\u0039\u0041-\u005A\u0061-\u007A\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\u0100-\u1FFF\u3040-\u9FFF\uF900-\uFDFF\uFE70-\uFEFE\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFDC]/;
var _REGEX_SPACE = /\s/;
var _REGEX_URLCHAR = new RegExp('(' + /[-:@a-zA-Z0-9_.,~%+\/\\?=&#;()$]/.source + '|' + _REGEX_WORDCHAR.source + ')');
var _REGEX_URL = new RegExp(/(?:(?:https?|s?ftp|ftps|file|smb|afp|nfs|(x-)?man|gopher|txmt):\/\/|mailto:)/.source + _REGEX_URLCHAR.source + '*(?![:.,;])' + _REGEX_URLCHAR.source, 'g');

// returns null if no URLs, or [[startIndex1, url1], [startIndex2, url2], ...]
function _findURLs(text)
{
    _REGEX_URL.lastIndex = 0;
    var urls = null;
    var execResult;
    while ((execResult = _REGEX_URL.exec(text)))
    {
      urls = (urls || []);
      var startIndex = execResult.index;
      var url = execResult[0];
      urls.push([startIndex, url]);
    }

    return urls;
}
