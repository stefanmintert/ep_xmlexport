var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");

var commentsPlugin = false;
var jsxml = false;


try {
    commentsPlugin = require("../ep_comments_page/commentManager.js");
} catch (e) {
    console.log("Can't load comments plug-in.");
    console.log(JSON.stringify(e));
}

try {
    jsxml = require("jsxml");
} catch (e) {
    console.log("Can't load jsxml. Implication: I can't use comments plug-in.");
    console.log(JSON.stringify(e));
    commentsPlugin = false;
}

var getCommentsXml = function(padId, referencedCommentIds, callback) {
    _loadComments(padId, function(comments){
        //console.warn("loaded comments: " + JSON.stringify(comments));
        var referencedComments = comments.filter(function(comment){
            return referencedCommentIds.indexOf(comment.key) > -1;
        });
        if (referencedComments.length < referencedCommentIds.length) {
            console.error("not all referenced comments " + JSON.stringify(referencedComments) + " are available in data! " + JSON.stringify(referencedCommentIds) );
        }
        var xmlString = comments.length > 0 ? _commentsToXml(referencedComments) : "";
        //console.warn("comment xml string: " + xmlString);
        callback(xmlString);
    });
};

function _loadComments(padId, callback) {
    if (commentsPlugin) {
        try {
            commentsPlugin.getComments(padId, function(err, padComments) {
                ERR(err);
                commentsPlugin.getCommentReplies(padId, function(err, commentReplies) {
                    ERR(err);
                    callback(_getCommentArray(padComments.comments, commentReplies.replies));
                });
            });
        } catch (e) {
            console.log("[ERROR] Could not retrieve comments." + e);
        }
    }
};

/**
 * 
 * convert comments object 
 * @param comments { "key": { comment data } }
 * @param replies  
 * to a more usable array 
 * @returns [{key: "key", value: {comment data}}, replies: [ { key: "key", value: { reply data }} ]}
 */
function _getCommentArray (comments, replies) {
    var commentArray = [];
    for (var commentId in comments) {
        if (comments.hasOwnProperty(commentId)){
            var commentReplies = _repliesForComment(replies, commentId);
            
            commentArray.push({
                key: commentId, 
                value: comments[commentId],
                replies: commentReplies});
        }
    }
    return commentArray;
};


function _repliesForComment (replies, commentId) {
    var repliesArray = [];
    for (var replyId in replies) {
        if (replies.hasOwnProperty(replyId) && replies[replyId].commentId === commentId) {
            repliesArray.push({key: replyId, value: replies[replyId]});
        }
    }
    return repliesArray;
};


function _commentsToXml(comments) {
    xmlString = "<comments>";
    for (var i = 0; i < comments.length; i++) {
        xmlString += _commentToXml(comments[i]);
    }
    xmlString += "</comments>\n";
    return xmlString;
}


function _commentToXml(comment) {
    var newCommentElement = [
        "comment", {
            id: comment.key.toString(),
            timestamp: comment.value.timestamp.toString(),
            isoDateTime: (new Date(comment.value.timestamp)).toISOString()
        }
    ];

    var newAuthorElement = [
        "author",
        { id: comment.value.author.toString() },
        comment.value.name.toString()
    ];

    newCommentElement.push(newAuthorElement);

    var newTextElement = [
        "text",
        {},
        comment.value.text.toString()
    ];

    newCommentElement.push(newTextElement);

    var replies = ["replies",{}];

    for (var i=0; i<comment.replies.length; i++) {
        var reply = [
            "comment",
            {
               id: comment.replies[i].key,
               timestamp: comment.replies[i].value.timestamp.toString(),
               isoDateTime: (new Date(comment.replies[i].value.timestamp)).toISOString()
            },
            [
                "author",
                { id: comment.replies[i].value.author.toString() },
                comment.replies[i].value.name.toString()
            ],
            [
                "text",
                {},
                comment.replies[i].value.text.toString()
            ]
        ];
        replies.push(reply);
    }

    if (replies.length > 2 ) { // only add replies element if there are reply children
        newCommentElement.push(replies);
    }

    return "\n" + jsxml.toXml(newCommentElement);
};


/*
 * Define exports
 *
 */
exports.getCommentsXml 	= getCommentsXml;


