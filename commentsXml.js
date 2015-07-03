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


    var commentsXml = (function() {

            // allComments = all comments saved for a pad (including those for older pad versions)
            var allComments = null;

            // currentPadComments = only those comments, that are required for the current pad content
            var currentPadComments = [];

            var init = function(padId) {

                    currentPadComments = [];

        if (commentsPlugin) {

            try {
                    commentsPlugin.getComments(padId, function(err, padComments) {
                            ERR(err);

                            commentsPlugin.getCommentReplies(padId, function(err, commentReplies) {
                                    ERR(err);

                                    allComments = {
                                                    comments: padComments.comments,
                                                    replies: commentReplies.replies
                                    };

                            });
                    });
            } catch (e) {
                    console.log("[ERROR] Could not retrieve comments." + e);
            }

        }
            };

            var selectComment = function(commentId) {
                    currentPadComments.push(commentId.toString());
            };

            var getCommentsXml = function() {
                    var xmlString = "";

                    if (allComments && currentPadComments.length > 0) {
                            xmlString = "<comments>";


                            for (var i = 0; i < currentPadComments.length; i++) {
                                    xmlString += commentToXml(currentPadComments[i]);
                            }
                            xmlString += "</comments>\n";
                    }

                    return xmlString;
            };

            var commentToXml = function(commentId) {
                    if (allComments.comments && allComments.comments[commentId]) {
                            var newCommentElement = [
                                                      "comment",
                                                      {
                                                              "id": commentId.toString(),
                                                              "timestamp": allComments.comments[commentId].timestamp.toString(),
                                                              "isoDateTime": (new Date(allComments.comments[commentId].timestamp)).toISOString()
                                                      },
                                                     ];


                            var newAuthorElement = [
                                                            "author",
                                                            {
                                                                    "id": allComments.comments[commentId].author.toString()
                                                            },
                                                            allComments.comments[commentId].name.toString()
                                                            ];

                            newCommentElement.push(newAuthorElement);

                            var newTextElement = [
                                                    "text",
                                                    {},
                                                    allComments.comments[commentId].text.toString()
                                                  ];


                            newCommentElement.push(newTextElement);


                            var replies = ["replies",{}];

                            for (var replyId in allComments.replies) {
                                    if (allComments.replies.hasOwnProperty(replyId) && allComments.replies[replyId].commentId == commentId) {

                                            var reply = [
                                                         "comment",
                                                         {
                                                             "id": replyId.toString(),
                                                             "timestamp": allComments.replies[replyId].timestamp.toString(),
                                                      "isoDateTime": (new Date(allComments.replies[replyId].timestamp)).toISOString()
                                                         },
                                                                    [
                                                                            "author",
                                                                            {
                                                                                    "id": allComments.replies[replyId].author.toString()
                                                                            },
                                                                            allComments.replies[replyId].name.toString()
                                                                    ],
                                                                    [
                                                                            "text",
                                                                            {},
                                                                            allComments.replies[replyId].text.toString()
                                                                     ]
                                                  ];

                                            replies.push(reply);
                                    }
                            }

                            if (replies.length > 2 ) { // only add replies element if there are reply children
                                    newCommentElement.push(replies);
                            }


                            return "\n" + jsxml.toXml(newCommentElement);

                    }

            };



            return {
                    init: init,
                    selectComment: selectComment,
                    getCommentsXml: getCommentsXml
            };
    })();

/*
 * Define exports
 *
 */
exports.init 			= commentsXml.init;
exports.selectComment 	= commentsXml.selectComment;
exports.getCommentsXml 	= commentsXml.getCommentsXml;


