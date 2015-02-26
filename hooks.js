var path = require('path');
var eejs = require("ep_etherpad-lite/node/eejs");
var exportXml = require('./ExportXml');

exports.expressCreateServer = function (hook_name, args, cb) {
	args.app.get('/p/:pad/:rev?/export/xml', function(req, res, next) {
		var padID = req.params.pad;
		var options = {
				revision: (req.params.rev ? req.params.rev : null),
				lists: (req.query.lists ? Boolean(req.query.lists) : false),
				lineattribs: (req.query.lineattribs ? Boolean(req.query.lineattribs) : false),
				regex: (req.query.regex ? Boolean(req.query.regex) : false),
				
		};
		
		
		exportXml.getPadXmlDocument(padID, options, function(err, result) {
			res.contentType('plain/xml');
			res.send(result);
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