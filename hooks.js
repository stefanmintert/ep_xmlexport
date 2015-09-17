var path = require('path');
var eejs = require("ep_etherpad-lite/node/eejs");
var exportXml = require('./ExportXml');
var prettyData = false;
var js2xmlparser = require("js2xmlparser");
var request = require("request");
var xslt = require("xslt4node");
var fs = require("fs");

try {
	prettyData = require('pretty-data').pd;
} catch (e) {
	console.log("Can't load pretty-data.");
	console.log(JSON.stringify(e));
}



exports.expressCreateServer = function (hook_name, args, cb) {
	args.app.get('/p/:pad/:rev?/export/xml', function(req, res, next) {
		var padID = req.params.pad;
		var options = {
				revision: (req.params.rev ? req.params.rev : null),
				lists: (req.query.lists ? req.query.lists.toString() === "true" : false),
				lineattribs: (req.query.lineattribs ? req.query.lineattribs.toString() === "true" : false),
				regex: (req.query.regex ? req.query.regex.toString() === "true" : false),
				pretty: (req.query.pretty ? req.query.pretty.toString() === "true" : false),
		};
		
		
		exportXml.getPadXmlDocument(padID, options, function(err, result) {
			res.contentType('plain/xml');
			if (prettyData && options.pretty) {
				res.send(prettyData.xml(result));
			} else {

				// Check to see if this PadId has associated Metadata
				// FAKED Until we have a valid API endpoint for getting Metadata for a PadId
				request.get("https://mymadison.io/api/docs/slug/digital-campaign-guide", function(e,r,b){
					if(e){
						console.error(e);
					}
					console.log(b);
					if(b.xslt === b.xslt){
						// FAKED FOR NOW, BILL PLEASE ADD THIS ATTRIBUTE
						options.xslt = "/home/jose/etherpad-lite/translate.xsl";
					}
					// Turn JSON Metadata into XML
					var xml = js2xmlparser("metadata", b);
					xml = xml.replace('<?xml version="1.0" encoding="UTF-8"?>','');
					// Append XML into Pad
					result = result.replace('<pad>', '<pad>'+xml);
					// console.log("result", result);

					// Check if Metadata includes XSLT -- FAKED!!
					if(options.xslt){
						var config = {};
						// console.log("Applying XSLT");
	                                        fs.readFile(options.xslt, 'utf8', function (err,data) {
							if(err) console.error("Error doing xslt export", e);
	                                                config.xslt = data;
	                                                config.source = result;
	                                                config.result = String;
	                                                xslt.transform(config, function(e, result){
	                                                        res.send(result);
	                                                });
	                                        });

		                        }else{
						res.send(result);
					}
				});
			}
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
