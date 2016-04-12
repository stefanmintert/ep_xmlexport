var path = require('path');
var eejs = require("ep_etherpad-lite/node/eejs");
var ExportService = require("./ExportService");


exports.expressCreateServer = function (hook_name, args, cb) {
    var contentTypes = { json: 'application/json', xml: 'plain/xml'};
    var _evalToBoolean = function(stringValue) {
        return typeof stringValue !== 'undefined' && stringValue === 'true';
    };

    var _getOptions = function(req) {
        return {
            revision:   (req.params.rev ? req.params.rev : null),
            lists:       _evalToBoolean(req.query.lists),
            lineattribs: _evalToBoolean(req.query.lineattribs),
            regex:       _evalToBoolean(req.query.regex),
            pretty:      _evalToBoolean(req.query.pretty)
        };
    };

    var handleXmlRequest = function(req, res, next) {
        var padID = req.params.pad;
        var options = _getOptions(req);
        options.exportFormat = "xml";

        ExportService.loadAndSerializePad(padID, options, function(result) {
            res.contentType(contentTypes[options.exportFormat]);
            res.send(result);
        }, function(error) {
            res.status(500).send(error);
        });
    };

    args.app.get('/p/:pad/:rev?/export/xml', handleXmlRequest);

    args.app.get('/api/1.2.12/p/:pad/:rev?/export/xml', handleXmlRequest);

    /**
    * Just a first Proof of Concept, DO NOT use this!!!
    */
    args.app.get('/p/:pad/:rev?/export/json', function(req, res, next) {
        var padID = req.params.pad;
        var options = _getOptions(req);
        options.exportFormat = "json";

        ExportService.loadAndSerializePad(padID, options, function(result) {
            res.contentType(contentTypes[options.exportFormat]);
            res.send(result);
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
