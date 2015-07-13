var xmlescape = require("xml-escape");

var XmlSerializer = {
    startDocument: function(){
        return '<?xml version="1.0"?>\n<pad>\n';
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
    }
};

module.exports = XmlSerializer;

