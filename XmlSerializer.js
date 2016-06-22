var xmlescape = require("xml-escape");
var jsxml = false;

try {
    jsxml = require("jsxml");
} catch (e) {
    console.log("Can't load jsxml. Implication: I can't use comments plug-in.");
    console.log(JSON.stringify(e));
    commentsPlugin = false;
}

var XmlSerializer = {
    startDocument: function(revisionDate){
        var padStartTag = '<pad' +
            (revisionDate ? ' revisionDate="' + revisionDate + "'" : '') +
            '>';
        return '<?xml version="1.0"?>\n' + padStartTag + '\n';
    },
    endDocument: function(){
        return '\n</pad>';
    },
    startContent: function(){
        return '<content>';
    },
    endContent: function(){
        return '</content>\n';
    },
    startAttribute: function(key, value){
        return '<attribute key="' + key + '" value="' + value + '">';
    },
    endAttribute: function(key){
        return '</attribute><!-- /' + key + ' -->';
    },
    startLine: function(lineAttributes){
        var lineStartTag = '<line';
            for (var i = 0; i < lineAttributes.length; i++) {
                lineStartTag += ' ';
                lineStartTag += lineAttributes[i][0];
                lineStartTag += '="';
                lineStartTag += lineAttributes[i][1];
                lineStartTag += '"';
            }
            lineStartTag += ">";
        return lineStartTag;
    },
    endLine: function(){
        return "</line>";
    },
    startList: function(listTypeName){
        return "\n<list type='" + listTypeName + "'>\n";
    },
    startItem: function(){
        return "<item>";
    },
    endItem: function(){
        return "</item>\n";
    },
    endList: function(){
        return "</list>\n";
    },
    escapeText: function(textContent){
        return xmlescape(textContent);
    },
    getMatchedText: function(key, value, contentMarkup) {
        return '<matched-text key="'+key+'" value="' + value + '">' + contentMarkup + '</matched-text>';
    },
    /**
     * creates the complete document, given the completely rendered document content
     * and all referenced comment as an jsonml compliant object
     * @param {type} contentMarkup
     * @param {type} comments
     * @returns {String}
     */
    getWrapup: function(contentMarkup, commentsMl, revisionDate){
        return this.startDocument(revisionDate) + this.startContent() +
            contentMarkup + 
            this.endContent() + 
            (jsxml && commentsMl.length > 1 ? jsxml.toXml(commentsMl) : "") + 
            this.endDocument();
    }
};

module.exports = XmlSerializer;

