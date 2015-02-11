var path = require('path');
var eejs = require("ep_etherpad-lite/node/eejs");
var exportXml = require('./ExportXml');

exports.expressCreateServer = function (hook_name, args, cb) {
	args.app.get('/p/:pad/:rev?/export/xml', function(req, res, next) {
		var padID = req.params.pad;
		var revision = req.params.rev ? req.params.rev : null;

		exportXml.getPadXmlDocument(padID, revision, function(err, result) {
			res.contentType('plain/text');
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