/*jshint loopfunc: true */
/* TODO refactor to be able to remove the above directive */
var Changeset = require("ep_etherpad-lite/static/js/Changeset");
var padManager = require("ep_etherpad-lite/node/db/PadManager");
var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");

//var DROPATTRIBUTES = ["insertorder"]; // exclude attributes from export
var DROPATTRIBUTES = []; 

function getPadXml(pad, reqOptions, callback) {
    var atext, xml;
	var revNum = reqOptions.revision;


    if (revNum) {
          pad.getInternalRevisionAText(revNum, function (err, revisionAtext) {
	        if (ERR(err, callback)) {
	        	atext = pad.atext;
	        } else {
	        	atext = revisionAtext;
	        }
	      }
          );
    } else {
	  atext = pad.atext;
    }
    
    xml = getXmlFromAtext(pad, atext, reqOptions);

    callback(null, xml);
}

function getXmlFromAtext(pad, atext, reqOptions) {
    var apool = pad.pool;
    var textLines = atext.text.slice(0, -1).split('\n');
    var attribLines = Changeset.splitAttributionLines(atext.attribs, atext.text);

    var props = [];
    var anumMap = {};

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
     * TODO: remove anumMap from the entire code.
     */
    props.forEach(function (propName, i) {
	  if (DROPATTRIBUTES.indexOf(propName) < 0) { // Attribute shall be dropped
		  anumMap[i] = i;
	  }
    });

    function getLineXml(text, attribs, apool) {
      var propVals = [false, false, false];
      var ENTER = 1;
      var STAY = 2;
      var LEAVE = 0;

      
      
      // Use order of tags (b/i/u) as order of nesting, for simplicity
      // and decent nesting.  For example,
      // <b>Just bold<b> <b><i>Bold and italics</i></b> <i>Just italics</i>
      // becomes
      // <b>Just bold <i>Bold and italics</i></b> <i>Just italics</i>
      var taker = Changeset.stringIterator(text);
      var assem = Changeset.stringAssembler();

      var openTags = [];
      function emitOpenTag(i) {
        openTags.unshift(i);
        assem.append('<attribute key="');
        assem.append(props[i]);
        assem.append('" value="');
        assem.append(apool.numToAttrib[i][1]);
        assem.append('">');
      }

      function emitCloseTag(i) {
        openTags.shift();
        assem.append('</attribute');
        assem.append('>');
      }
      
      function orderdCloseTags(tags2close) {
        for(var i=0;i<openTags.length;i++) {
          for(var j=0;j<tags2close.length;j++) {
            if(tags2close[j] == openTags[i]) {
              emitCloseTag(tags2close[j]);
              i--;
              break;
            }
          }
        }
      }
      
      
      
      
      var idx = 0;
      
      
      var lmkr = false;
      var lineAttributes = [];

      if (reqOptions.lineattribs === true) {
	    // start lineMarker (lmkr) check
	    var deletedAsterisk = false; // we need to delete * from the beginning of the heading line
	    var firstCharacterOfLineIterator = Changeset.opIterator(Changeset.subattribution(attribs, 0, 1));
	
	    if (firstCharacterOfLineIterator.hasNext()) {
	      var o2 = firstCharacterOfLineIterator.next();
	      
	      // iterate through attributes
	      Changeset.eachAttribNumber(o2.attribs, function (a) {		    
		    lineAttributes.push([apool.numToAttrib[a][0], apool.numToAttrib[a][1]]);
	
		    if (apool.numToAttrib[a][0] === "lmkr") {
	    		lmkr = true;
	    	}
	      });
	    }    
      
      
	    
	    if (lmkr) {
	    	idx = 1;  // begin attribute processing after lmkr character
	    }
      }
      
      
      
      
      

      var urls = _findURLs(text);

      function processNextChars(numChars) {
        var tags2close = [];
        
        if (numChars <= 0) {
          return;
        }

        var iter = Changeset.opIterator(Changeset.subattribution(attribs, idx, idx + numChars));
        idx += numChars;

        while (iter.hasNext())
        {
          var o = iter.next();
          var propChanged = false;
          Changeset.eachAttribNumber(o.attribs, function (a)
          {
            if (a in anumMap)
            {
              var i = anumMap[a]; // i = 0 => bold, etc.
              if (!propVals[i])
              {
                propVals[i] = ENTER;
                propChanged = true;
              }
              else
              {
                propVals[i] = STAY;
              }
            }
          });
          for (var j = 0; j < propVals.length; j++) {
            if (propVals[j] === true)
            {
              propVals[j] = LEAVE;
              propChanged = true;
            }
            else if (propVals[j] === STAY)
            {
              propVals[j] = true; // set it back
            }
          }

          // now each member of propVal is in {false,LEAVE,ENTER,true}
          // according to what happens at start of span
          if (propChanged)
          {
            // leaving bold (e.g.) also leaves italics, etc.
            var left = false;
            for (var i = 0; i < propVals.length; i++)
            {
              var v = propVals[i];
              if (!left)
              {
                if (v === LEAVE)
                {
                  left = true;
                }
              }
              else
              {
                if (v === true)
                {
                  propVals[i] = STAY; // tag will be closed and re-opened
                }
              }
            }

            tags2close = [];

            for (var k = propVals.length - 1; k >= 0; k--) {
              if (propVals[k] === LEAVE)
              {
                //emitCloseTag(i);
                tags2close.push(k);
                propVals[k] = false;
              }
              else if (propVals[k] === STAY)
              {
                //emitCloseTag(i);
                tags2close.push(k);
              }
            }
            
            orderdCloseTags(tags2close);
            
            for (var l = 0; l < propVals.length; l++)
            {
              if (propVals[l] === ENTER || propVals[l] === STAY)
              {
                emitOpenTag(l);
                
                propVals[l] = true;
              }
            }
            // propVals is now all {true,false} again
          } // end if (propChanged)
          var chars = o.chars;
          if (o.lines)
          {
            chars--; // exclude newline at end of line, if present
          }
          
          var s = taker.take(chars);
          
          //removes the characters with the code 12. Don't know where they come 
          //from but they break the abiword parser and are completly useless
          s = s.replace(String.fromCharCode(12), "");
          
          if (lmkr) {
          	s = s.substring(1);
          }
          
          
          assem.append(s);
        } // end iteration over spans in line
        
        tags2close = [];
        for (var n = propVals.length - 1; n >= 0; n--)
        {
          if (propVals[n])
          {
            tags2close.push(n);
            propVals[n] = false;
          }
        }
        
        orderdCloseTags(tags2close);
      } // end processNextChars

      
      /* TODO: URI detection should be re-worked to fit in XML structure
      if (urls) {
        urls.forEach(function (urlData) {
          var startIndex = urlData[0];
          var url = urlData[1];
          var urlLength = url.length;
          processNextChars(startIndex - idx);
          assem.append('<uri>');
          processNextChars(urlLength);
          assem.append('</uri>');
        });
      }
      */
      
      processNextChars(text.length - idx);
    
      // replace &, _
      assem = assem.toString();
      assem = assem.replace(/\&/g, '\&amp;');
      
      var startTag = '<line';
      var endTag = '</line>';
      
      if (lmkr) {
      	for (var i = 0; i < lineAttributes.length; i=i+1) {
      		startTag += ' ';
      		startTag += lineAttributes[i][0];
      		startTag += '="';
      		startTag += lineAttributes[i][1];
      		startTag += '"';    		
      	}
      }
      startTag += ">";
      

      return startTag + assem + endTag;
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
}

function _analyzeLine(text, aline, apool, reqOptions)
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
}

exports.getPadXmlDocument = function (padId, reqOptions, callback) {
	
	  padManager.getPad(padId, function (err, pad)
	  {
	    if(ERR(err, callback)) return;
	
	    getPadXml(pad, reqOptions, function (err, xml) {
	      if(ERR(err, callback)) return;
	      callback(null, '<?xml version="1.0"?>\n<pad>\n' + xml + '\n</pad>');
	    });
	  });
};

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
