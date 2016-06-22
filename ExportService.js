var padManager = require("ep_etherpad-lite/node/db/PadManager");
var throwIfError = require("ep_etherpad-lite/node_modules/async-stacktrace");

var PadProcessor = require('./PadProcessor');
var commentLoader = require("./commentLoader");
var xmlSerializer = require("./XmlSerializer");
var jsonSerializer = require("./JsonSerializer");

var prettyData = false;

try {
    prettyData = require('pretty-data').pd;
} catch (e) {
    console.log("Can't load pretty-data.");
    console.log(JSON.stringify(e));
}

var serializers = { json: jsonSerializer, xml: xmlSerializer};


/*
* Choose the appropriate serializer (depending on options.exportFormat),
* load the document pad
* and tell the PadProcessor to serialize it.
* @param padId
* @param options
* @param callback to be called with the serialized document as a String
*/
var loadAndSerializePad = function(padId, options, callback) {
    var serializer = serializers[options.exportFormat];
    _loadPad(padId, options.revision, function(pad){
        PadProcessor.getSerializedPad(pad, commentLoader, serializer, options, function(result){
            if (prettyData && options.pretty) {
                var prettyResult = options.exportFormat === "json" ? prettyData.json(result) : prettyData.xml(result);
                callback(prettyResult);
            } else {
                callback(result);
            }
        });
    });
};

/*
 * @param padId
 * @param revision (optional)
 * @param callback to be called with { id: padId, pool: pad.pool, atext: pad.atext}
 */
function _loadPad (padId, revision, callback) {
    padManager.getPad(padId, function (err, pad) {
        throwIfError(err);
        if (revision) {
            pad.getInternalRevisionAText(revision, function (err, revisionAtext) {
                throwIfError(err);                
                pad.getRevisionDate(revision, function(err, revisionDate) {
                    throwIfError(err);
                    callback({ id: padId, pool: pad.pool, atext: revisionAtext, revisionDate: revisionDate});
                });
            });
        } else {
            pad.getLastEdit(function(err, lastEdit){
                throwIfError(err);
                callback({ id: padId, pool: pad.pool, atext: pad.atext, revisionDate: lastEdit});
            });
        }
    });
};
    
exports.loadAndSerializePad = loadAndSerializePad; 

