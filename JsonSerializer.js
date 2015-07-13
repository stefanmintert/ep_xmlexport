/**
 * Just a first Proof of Concept, do no use this!
 */
var JsonSerializer = {
    startDocument: function(){
        return '["pad",\n';
    },
    endDocument: function(){
        return '\n]';
    },
    startContent: function(){
        return '["content", \n{';
    },
    endContent: function(){
        return ']\n';
    },
    startAttribute: function(key, value){
        return '["attribute", {"key": "'+key+'", "value": "'+value+'"},';
    },
    endAttribute: function(key){
        return ']';
    },
    startLine: function(lineAttributes){
        var lineStart = '["line", {';
        lineStart += '"lineAttributes": ' + JSON.stringify(lineAttributes);
        
        lineStart += "}, \n[";
        return lineStart;
    },
    endLine: function(){
        return '""]';
    },
    startList: function(listTypeName){
        return '\n["list", { "type": "' + listTypeName + '"},';
    },
    startItem: function(){
        return '["item", ';
    },
    endItem: function(){
        return "]\n";
    },
    endList: function(){
        return "]\n";
    },
    escapeText: function(textContent){
        return '"' + textContent + '", ';
    },
    getMatchedText: function(key, value, contentMarkup) {
        return '"' + contentMarkup + '", ';
    }
};

module.exports = JsonSerializer;
