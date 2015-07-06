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

var init = function(padId, callback) {
    if (commentsPlugin) {
        try {
            commentsPlugin.getComments(padId, function(err, padComments) {
                ERR(err);
                commentsPlugin.getCommentReplies(padId, function(err, commentReplies) {
                    ERR(err);
                    var allComments = {
                        comments: padComments.comments,
                        replies: commentReplies.replies
                    };
                    callback(allComments);
                });
            });
        } catch (e) {
            console.log("[ERROR] Could not retrieve comments." + e);
        }
    }
};

var _repliesForComment = function(comments, commentId) {
    var replies = [];
    for (var replyId in comments.replies) {
        if (comments.replies.hasOwnProperty(replyId) && comments.replies[replyId].commentId === commentId) {
            replies.push({key: replyId, value: comments.replies[replyId]});
        }
    }
    return replies;
};

var _getCommentArray = function(comments) {
    var commentArray = [];
    for (var commentId in comments.comments) {
        if (comments.comments.hasOwnProperty(commentId)){
            commentArray.push({key: commentId, value: comments.comments[commentId]});
        }
    }
    return commentArray;
};


var getCommentsXml = function(padId, callback) {
    var xmlString = "";
    //console.warn("COMMENTSTOXML: "+JSON.stringify(allComments));
    init(padId, function(comments){
        console.warn("COMMENTS: " + JSON.stringify(comments));
        if (Object.keys(comments.comments).length > 0) {
            xmlString = "<comments>";
            var commentArray = _getCommentArray(comments);
            for (var i = 0; i < commentArray.length; i++) {
                var comment = commentArray[i].value;
                var repliesForCurrentComment = _repliesForComment(comments, commentArray[i].key);
                xmlString += commentToXml(commentArray[i].key, comment, repliesForCurrentComment);
            }
            xmlString += "</comments>\n";
        }

        callback(xmlString);
    });
};

var commentToXml = function(commentId, comment, commentReplies) {
    if (comment) {
        var newCommentElement = [
            "comment", {
              id: commentId.toString(),
              timestamp: comment.timestamp.toString(),
              isoDateTime: (new Date(comment.timestamp)).toISOString()
            }
        ];

        var newAuthorElement = [
            "author",
            { id: comment.author.toString() },
            comment.name.toString()
        ];

        newCommentElement.push(newAuthorElement);

        var newTextElement = [
            "text",
            {},
            comment.text.toString()
        ];


        newCommentElement.push(newTextElement);


        var replies = ["replies",{}];

        for (var i=0; i<commentReplies.length; i++) {
            var reply = [
                "comment",
                {
                   id: commentReplies[i].key,
                   timestamp: commentReplies[i].value.timestamp.toString(),
                   isoDateTime: (new Date(commentReplies[i].value.timestamp)).toISOString()
                },
                [
                    "author",
                    { id: commentReplies[i].value.author.toString() },
                    commentReplies[i].value.name.toString()
                ],
                [
                    "text",
                    {},
                    commentReplies[i].value.text.toString()
                ]
            ];

            replies.push(reply);
        }

        if (replies.length > 2 ) { // only add replies element if there are reply children
            newCommentElement.push(replies);
        }
        
        return "\n" + jsxml.toXml(newCommentElement);

    }

};


/*
 * Define exports
 *
 */
exports.getCommentsXml 	= getCommentsXml;


