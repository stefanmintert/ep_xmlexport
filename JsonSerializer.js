/**
 * Just a first Proof of Concept, do no use this!
 */
var JsonSerializer = {
    startDocument: function(){
        return '["pad",\n';
    },
    endDocument: function(){
        return ']';
    },
    startContent: function(){
        return '["content", \n';
    },
    endContent: function(){
        return '""]\n';
    },
    startAttribute: function(key, value){
        return '["attribute", {"key": "'+key+'", "value": "'+value+'"},';
    },
    endAttribute: function(key){
        return '""], ';
    },
    startLine: function(lineAttributes){
        var lineStart = '["line", {';
        lineStart += '"lineAttributes": ' + JSON.stringify(lineAttributes);
        
        lineStart += "}, \n";
        return lineStart;
    },
    endLine: function(){
        return '""],';
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
    },
    /**
     * creates the complete document, given the completely rendered document content
     * and all referenced comment as an jsonml compliant object
     * @param {type} contentMarkup
     * @param {type} comments
     * @returns {String}
     */
    getWrapup: function(contentMarkup, comments){
        return this.startDocument() + this.startContent() +
            contentMarkup + 
            this.endContent() + 
            (comments.length > 1 ? "," + JSON.stringify(comments) : "") + 
            this.endDocument();
    }
};

module.exports = JsonSerializer;
