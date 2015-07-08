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
    var urls = [];
    var execResult;
    while (execResult = _REGEX_URL.exec(text)) {
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
exports.findURLs = findURLs;
