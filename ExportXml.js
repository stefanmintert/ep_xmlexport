/*jshint loopfunc: true */
/* TODO refactor to be able to remove the above directive */


(function() {
    var Changeset = require("ep_etherpad-lite/static/js/Changeset");
    var padManager = require("ep_etherpad-lite/node/db/PadManager");
    var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");
    var commentsXml = require("./commentsXml.js");
    var xmlescape = require("xml-escape");
    var utils = require("./exportUtils.js");

    var getPadXml = function (pad, reqOptions, callback) {
        var atext, xml, xmlComments;
        var revNum = reqOptions.revision;

        if (revNum) {
              pad.getInternalRevisionAText(revNum, function (err, revisionAtext) {
                    if (ERR(err, callback)) {
                            atext = pad.atext;
                    } else {
                            atext = revisionAtext;
                    }

                    padContentXml = "<content>"  + getXmlFromAtext(pad, atext, reqOptions) + "</content>\n";
                    xmlComments = commentsXml.getCommentsXml();
                    callback(null, padContentXml + xmlComments);
                  });
        } else {
              atext = pad.atext;
              padContentXml = "<content>"  + getXmlFromAtext(pad, atext, reqOptions) + "</content>\n";
              xmlComments = commentsXml.getCommentsXml();
              callback(null, padContentXml + xmlComments);
            }
    };


    var getXmlFromAtext = function (pad, atext, reqOptions) {
        var apool = pad.pool;
        var textLines = atext.text.slice(0, -1).split('\n');
        var attribLines = Changeset.splitAttributionLines(atext.attribs, atext.text);

        var props = [];
        var anumMap = {};

        props = utils.getPropertyNames(apool);


        function getLineXml(text, attribs, apool) {
            var lmkr = false;
            var lineAttributes = [];
            var xmlStringAssembler = Changeset.stringAssembler();
            var urls;
            var textIterator = Changeset.stringIterator(text);

            utils.openElements.init(); // no elements are open


            /*
             * getXmlForLineSegment
             * Gets text with length of 'numChars' starting from current position of lineIterator.
             * Returns both, text with markup and plain text as literal object
             * { withMarkup: ..., plainText: ... }
             *
             */
            function getXmlForLineSegment(lineIterator, lineLength, numChars) {
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
            } // end getXmlForLineSegment




            anumMap = utils.populateAnumMap(props);

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


                xmlStringAssembler.append(getXmlForLineSegment(textIterator, text.length, startIndex - utils.getIteratorIndex(textIterator, text.length)).withMarkup);

                var uriText = getXmlForLineSegment(textIterator, text.length, urlLength);

                xmlStringAssembler.append('<matched-text key="uri" value="' + uriText.plainText + '">' + uriText.withMarkup + '</matched-text>');
              });
            }



            xmlStringAssembler.append(getXmlForLineSegment(textIterator, text.length, textIterator.remaining()).withMarkup);

            var lineContentString = xmlStringAssembler.toString();


            return utils.createLineElement(lineAttributes, lineContentString, lmkr);


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
          var line = utils.analyzeLine(textLines[i], attribLines[i], apool, reqOptions);
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
              pieces.push("\n<list type='" + line.listTypeName + "'>\n<item>", lineContent || "\n"); // number or bullet
            }

            else//means we are getting closer to the lowest level of indentation
            {
              while (whichList < lists.length - 1) {
                pieces.push("</item>\n</list>"); // number or bullet
                lists.length--;
              }
              pieces.push("</item>\n<item>", lineContent || "\n");
            }
          } else//outside any list
          {
            while (lists.length > 0)//if was in a list: close it before
            {
              pieces.push("</item>\n</list>\n"); // number or bullet
              lists.length--;
            }
            pieces.push(lineContent, "\n");
          }
        }

        for (var k = lists.length - 1; k >= 0; k--) {
          pieces.push("\n</list>\n"); // number or bullet
        }

        return pieces.join("");
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
        padManager.getPad(padId, function (err, pad) {
            if (ERR(err, callback)) return;
            commentsXml.init(padId);

    		getPadXml(pad, reqOptions, function (err, xml) {
                if (ERR(err, callback)) {
                	return;
                } else {
                	callback(null, '<?xml version="1.0"?>\n<pad>\n' + xml + '\n</pad>');
                }
            });

        });
    };


    /*
     * Define exports
     *
     */
    exports.getPadXmlDocument = getPadXmlDocument;


})();






