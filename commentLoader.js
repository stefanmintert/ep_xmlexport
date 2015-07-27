var throwIfError = require("ep_etherpad-lite/node_modules/async-stacktrace");

var commentsPlugin = false;

try {
    commentsPlugin = require("../ep_comments_page/commentManager.js");
} catch (e) {
    console.log("Can't load comments plug-in.");
    console.log(JSON.stringify(e));
}

var getComments = function(padId, referencedCommentIds, callback) {
    _loadComments(padId, function(comments){
        var referencedComments = comments.filter(function(comment){
            return referencedCommentIds.indexOf(comment.key) > -1;
        });
        if (referencedComments.length < referencedCommentIds.length) {
            console.error("not all referenced comments " + JSON.stringify(referencedComments) + " are available in data! " + JSON.stringify(referencedCommentIds) );
        }
        callback(_commentsToJsonml(referencedComments));
    });
};

function _loadComments(padId, callback) {
    if (commentsPlugin) {
        commentsPlugin.getComments(padId, function(err, padComments) {
            throwIfError(err);
            commentsPlugin.getCommentReplies(padId, function(err, commentReplies) {
                throwIfError(err);
                callback(_getCommentArray(padComments.comments, commentReplies.replies));
            });
        });
    } else {
	callback([]);
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


function _commentsToJsonml(comments) {    
    var commentsElement = [ "comments" ];
    comments.forEach(function(comment){
        commentsElement.push(_commentToJsonml(comment));
    });
    return commentsElement;
}


function _commentToJsonml(comment) {
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

    return newCommentElement;
};


exports.getComments = getComments;

