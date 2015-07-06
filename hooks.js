var path = require('path');
var eejs = require("ep_etherpad-lite/node/eejs");
var exportXml = require('./ExportXml');
var prettyData = false;

try {
    prettyData = require('pretty-data').pd;
} catch (e) {
    console.log("Can't load pretty-data.");
    console.log(JSON.stringify(e));
}


exports.expressCreateServer = function (hook_name, args, cb) {
    var _evalToBoolean = function(stringValue) {
        return typeof stringValue !== 'undefined' && stringValue === 'true';
    };
    
    args.app.get('/p/:pad/:rev?/export/xml', function(req, res, next) {
        var padID = req.params.pad;
        var options = {
            revision:   (req.params.rev ? req.params.rev : null),
            lists:       _evalToBoolean(req.query.lists),
            lineattribs: _evalToBoolean(req.query.lineattribs),
            regex:       _evalToBoolean(req.query.regex),
            pretty:      _evalToBoolean(req.query.pretty)
        };


        exportXml.getPadXmlDocument(padID, options, function(result) {
            res.contentType('plain/xml');
            if (prettyData && options.pretty) {
                res.send(prettyData.xml(result));
            } else {
                res.send(result);
            }
        }, function(error) {
            res.status(500).send(error);
        });
    });
};

exports.eejsBlock_exportColumn = function(hook_name, args, cb) {
    args.content = args.content + eejs.require("ep_xmlexport/templates/exportcolumn.html", {}, module);
    return cb();
};

exports.eejsBlock_scripts = function (hook_name, args, cb) {
    args.content = args.content + eejs.require("ep_xmlexport/templates/scripts.html", {}, module);
    return cb();
};

exports.eejsBlock_styles = function (hook_name, args, cb) {
    args.content = args.content + eejs.require("ep_xmlexport/templates/styles.html", {}, module);
    return cb();
};