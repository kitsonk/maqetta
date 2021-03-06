define([
	"dojo/_base/declare",
	"dijit/_Widget",
	"dijit/_Templated",
	"davinci/review/util",
	"dijit/Menu",
	"dijit/MenuItem",
	"dijit/form/DropDownButton",
	"dojo/i18n!./nls/widgets"
], function(declare, _Widget, _Templated, util, Menu, MenuItem, DropDownButton, widgetsNls) {
	
return declare("davinci.review.widgets.Comment", [_Widget, _Templated], {

	templateString: dojo.cache("davinci", "review/widgets/templates/Comment.html"),

	postMixInProperties : function() {
		this.inherited(arguments);
		/*
		 * HACK: dijit pulls template substitutions from 'this'. copy values out of NLS
		 * lang object into properties on this object. hope they don't collide.
		 */
		this.by = widgetsNls.by;
		this.edit = widgetsNls.edit;
		this.reply = widgetsNls.reply;
		this.typeLabel = widgetsNls.typeLabel;
		this.severityLevel = widgetsNls.severityLevel;
		this.statusLabel = widgetsNls.statusLabel;

	},

	VISIBLE_PART_LENGTH: 80, // By default, how many leading characters of the comment will be shown.

	postCreate: function() {
		if (!this.existed) {
			// Ensure that the comment is created on the server when it is "newed".
			var location = davinci.Workbench.location().match(/http:\/\/.*:\d+\//);
			dojo.xhrPost({
				url: location + "maqetta/cmd/addComment",
				handleAs: "json",
				content: {
					id: this.commentId,
					subject: this.subject,
					content: this.content,
					ownerId: this.ownerId,
					previous: this.previous,
					next: this.next,
					pageState: this.pageState,
					viewScene: this.viewScene,
					pageName: this.pageName,
					replyTo: this.replyTo || 0,
					drawingJson: this.drawingJson,
					status: this.status,
					type: this.type,
					severity: this.severity
				},
				error: dojo.hitch(this, function(response) {
					dojo.publish("/davinci/review/commentAddedError", [this]);
					var msg = response.responseText;
					msg = msg.substring(msg.indexOf("<title>")+7, msg.indexOf("</title>"));
					davinci.Runtime.handleError(dojo.string.substitute(widgetsNls.errorAddingCom, [response, msg]));
				})
			}).then(dojo.hitch(this, "_populate"));
		} else {
			this._populate(this);
		}

		this.comments = []; // Hold the replies to this comment
		this.collapsed = false;
		this.enabled = true;
		this.focused = false;

		// Populate the comment body
		var color = this.color = davinci.Runtime.getColor(this.ownerId);
		this.subjectNode.innerHTML = this.subject;
		dojo.style(this.subjectNode, "color", color);
		this.ownerName.innerHTML = this.ownerId;
		dojo.style(this.ownerName, "color", color);
		this.contentNode.innerHTML = this.content;
		this._ajustLengthOfCommentContent(true);
		this.commentType.innerHTML = this.type;
		dojo.addClass(this.commentSeverity, "severity" + this.severity);
		// Rendering that has something to do with a reply comment
		if (!this.isReply()) {
			if (this.isPageOwner()) {
				this._constructStatus(this.status);
			} else {
				this.commentStatus.innerHTML = this.status;
			}
		} else {
			dojo.addClass(this.subjectNode, "displayNone");
			dojo.style(this.domNode, "borderTop", "1px solid #CCCCCC");
			dojo.addClass(this.commentStatusLabel,"displayNone");
		}

		this.connect(this.imgNode, "click", "_toggleReplies");
		this.connect(this.replyCountButton, "click", "_toggleReplies");
		this.connect(this.editButton, "click", "_editComment");
		this.connect(this.replyButton, "click", "_newReply");
		this.connect(this.mainBody, "click", "focusComment");
		this.connect(this.mainBody, "dblclick", "_editComment");
		if (this.closed) {
			dojo.style(this.editButton, "display", "none");
			dojo.style(this.replyButton, "display", "none");
		}
		davinci.Runtime.commenting_reviewerName = {};
		davinci.Runtime.commenting_reviewerName.userName = davinci.Runtime.getDesigner();
		davinci.Runtime.commenting_reviewerName.email = davinci.Runtime.getDesignerEmail();

		if (davinci.Runtime.commenting_reviewerName.userName != this.ownerId) {
			dojo.style(this.editButton,"display","none");
		}
		if (this.status == "Close") {
			dojo.style(this.editButton,"display","none");
			dojo.style(this.replyButton,"display","none");
		}
	},

	refresh: function() {
		dojo.style(this.editButton, "display", "inline");
		dojo.style(this.replyButton, "display", "inline");
		if (this.closed) {
			dojo.style(this.editButton, "display", "none");
			dojo.style(this.replyButton, "display", "none");
		}
		if (davinci.Runtime.commenting_reviewerName.userName != this.ownerId) {
			dojo.style(this.editButton, "display", "none");
		}
		if (this.status == "Close") {
			dojo.style(this.editButton, "display", "none");
			dojo.style(this.replyButton, "display", "none");
		}
	},

	_populate: function(result) {
		// summary:
		//		Fill the time, comment order. These info need to be retrieved from the server
		this.created = parseInt(result.created);
		this.createTime.innerHTML = util.toRelativeTime(util.toLocalTime(new Date(parseInt(result.created))), new Date(), 604800 );
	},

	_constructStatus : function(defaultLabel) {
		var statusList = new Menu();
		this.commentStatus = new DropDownButton( {
			label: defaultLabel,
			iconClass: "dijitEditorIcon emptyIcon",
			dropDown: statusList
		}, this.commentStatus);

		statusList.addChild(new MenuItem({
			label: widgetsNls.open,
			onClick: dojo.hitch(this, "_setStatusBtnLabel", "Open")
		}));

		statusList.addChild(new MenuItem({
			label: widgetsNls.close,
			onClick: dojo.hitch(this, "_setStatusBtnLabel", "Close")
		}));
		if(!dojo.hasClass(this.commentStatus.domNode.parentNode, "commentTheme")){
			dojo.addClass(this.commentStatus.domNode.parentNode, "commentTheme");
		}
	},

	_setStatusBtnLabel: function(label) {
		this.commentStatus.set("label", label);
		this.status = label;
		this.update({statusChanged:true});
	},

	update : function(arg) {
		this.subjectNode.innerHTML = this.subject;
		this.contentNode.innerHTML = this.content;
		this.commentType.innerHTML = this.type;
		this._ajustLengthOfCommentContent(true);
		dojo.removeClass(this.commentSeverity, "severityLow");
		dojo.removeClass(this.commentSeverity, "severityMedium");
		dojo.removeClass(this.commentSeverity, "severityHigh");
		dojo.addClass(this.commentSeverity, "severity" + this.severity);
		if (this.commentStatus.set) {
			this.commentStatus.set("label", this.status);
		}
		// Indicate that this is a change of the comment status (open/close)
		var updateStatus = arg && arg.statusChanged;
		var location = davinci.Workbench.location().match(/http:\/\/.*:\d+\//);
		dojo.xhrPost({
			url: location + "maqetta/cmd/updateComment",
			handleAs: "json",
			content: {
				id: this.commentId,
				status: this.status,
				subject:  this.subject,
				content:  this.content,
				pageState:  this.pageState,
				viewScene: this.viewScene,
				drawingJson: this.drawingJson,
				type: this.type,
				severity: this.severity,
				isUpdateStatus: updateStatus
			},
			error: function(response) {
				var msg = response.responseText;
				msg = msg.substring(msg.indexOf("<title>")+7, msg.indexOf("</title>"));
				davinci.Runtime.handleError(dojo.string.substitute(widgetsNls.errorUpdateCom, [response, msg]));
			}
		}).then(dojo.hitch(this,function() {
			if (updateStatus) {
				// Only status (close/open) change needs to be addressed
				dojo.publish("/davinci/review/commentStatusChanged", [this, this.status]);
			}
		}));
	},

	_editComment: function() {
		if (this.isDisabled) {
			return;
		}
		this.onEditComment({
			commentId: this.commentId
		});
	},

	onEditComment: function(args) {
		// Placeholder
	},

	_newReply: function() {
		if (this.isDisabled) {
			return;
		}
		this.onNewReply({
			replyTo: this.commentId,
			subject: "Re: " + this.subject
		});
	},

	onNewReply: function(args) {
		// Placeholder
	},

	isReply: function() {
		// summary: 
		//		Indicate if this is a reply
//		return this.depth > 0;
		return this.replyTo != "0";
	},

	isPageOwner: function() {
		// summary:
		//		Indicate if the reviewer is the page author
		return davinci.Runtime.commenting_designerName == davinci.Runtime.userName;
	},

	appendReply: function(/*davinci.review.widgets.Comment*/ reply) {
		this.comments.push(reply);
		reply.placeAt(this.commentReplies);
		if (dojo.hasClass(this.replyRegion, "displayNone")) {
			dojo.removeClass(this.replyRegion, "displayNone");
		}
		var len = this.getReplies().length;
		this.replyCountButton.innerHTML = len + (len == 1 ? " Reply" : " Replies");
	},

	getReplies: function() {
		return this.comments;
	},

	_toggleReplies: function() {
		if (this.collapsed) {
			this.expand();
		} else {
			this.collapse();
		}
	},

	collapse: function(/*Boolean*/ all) {
		if (all) {
			var replies = this.getReplies();
			dojo.forEach(replies, function(reply) {
				reply.collapse(all);
			});
		}
		if (!this.collapsed) {
			dojo.removeClass(this.imgNode, "dijitTreeExpandoOpen");
			dojo.addClass(this.imgNode, "dijitTreeExpandoClosed");
			dojo.addClass(this.commentReplies, "displayNone");
		}
		this.collapsed = true;
	},

	expand: function(/*Boolean*/ all) {
		if (all) {
			var replies = this.getReplies();
			dojo.forEach(replies, function(reply) {
				reply.expand(all);
			});
		}
		if (this.collapsed) {
			dojo.removeClass(this.imgNode, "dijitTreeExpandoClosed");
			dojo.addClass(this.imgNode, "dijitTreeExpandoOpen");
			dojo.removeClass(this.commentReplies, "displayNone");
		}
		this.collapsed = false;
	},

	focusComment: function(evt) {
		if (this.isDisabled) {
			return;
		}
		if (this.isFocused && evt && (evt.ctrlKey || evt.metaKey)) {
			this.blurComment();
		} else {
			this.onCommentFocus(this, evt);
			dojo.addClass(this.mainBody, "commentFocused");
			this.isFocused = true;
		}
	},

	onCommentFocus: function(widget) {
		// Placeholder
	},

	blurComment: function(silent) {
		if (!silent) {
			this.onCommentBlur(this);
		}
		dojo.removeClass(this.mainBody, "commentFocused");
		this.isFocused = false;
	},

	onCommentBlur: function(widget) {
		// Placeholder
	},

	/**
	 * Fold or not the characters after a specified position of
	 * a comment. The position is specified by
	 * davinci.review.widgets.Comment.VISIBLE_PART_LENGTH.
	 * 
	 * @param comment
	 *            Object of davinci.review.widgets.Comment.
	 * @param toFold
	 *            Boolean, to fold or unfold the comment.
	 * @returns Nothing.
	 */
	_ajustLengthOfCommentContent: function(toFold) {
		var content = this.content;
		if (content.length <= this.VISIBLE_PART_LENGTH) {
			var link = dojo.query("a", this.contentNode);
			if(link.length > 0) { 
				this.contentNode.removeChild(link[0]);
			}
			return;
		}
		var linkHtml = toFold ? widgetsNls.more : widgetsNls.commentHide;

		var unfoldLink = dojo.create("a", {
			"class": "commentLinkButton",
			innerHTML: linkHtml,
			onclick: dojo.hitch(this, "_ajustLengthOfCommentContent", !toFold)
		});
		if (content) {
			if (toFold) {
				this.contentNode.innerHTML = content.substring(0, this.VISIBLE_PART_LENGTH);
			} else {
				this.contentNode.innerHTML = content;
			}
			this.contentNode.appendChild(unfoldLink);
		}
	},

	hide: function() {
		dojo.style(this.mainBody, "display", "none");
	},

	show: function() {
		dojo.style(this.mainBody, "display", "block");
		dojo.window.scrollIntoView(this.domNode);
	},

	enable: function() {
		if (this.commentStatus.set) {
			this.commentStatus.set("disabled", false);
		}
		dojo.removeClass(this.domNode, "disabled");
		dojo.removeClass(this.mainBody, "commentBodyDisabled");
		dojo.style(this.subjectNode, "color", this.color);
		dojo.style(this.ownerName, "color", this.color);
		this.isDisabled = false;
	},

	disable: function() {
		if (this.commentStatus.set) {
			this.commentStatus.set("disabled", true);
		}
		dojo.addClass(this.domNode, "disabled");
		dojo.removeAttr(this.mainBody, "style");
		dojo.addClass(this.mainBody, "commentBodyDisabled");
		dojo.style(this.subjectNode, "color", "");
		dojo.style(this.ownerName, "color", "");
		this.isDisabled = true;
	},

	getBody: function() {
		return this.mainBody;
	}

});
});