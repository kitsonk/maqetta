define([
        "dojo/_base/declare",
        "./widget",
        "./_Widget",
        "./metadata"
], function(declare, widget, _Widget, metadata) {

return declare("davinci.ve.ChooseParent", null, {
	
	constructor: function(args){
		this._context = args.context;
	},
	
	/**
	 * Create a candidate list of valid parents for the dropped widget, based on the widgets'
	 * 'allowedChild' and 'allowedParent' properties. The logic ascends the DOM hierarchy
	 * starting with "target" to find all possible valid parents. If no valid parent is
	 * found, then return an empty array.
	 * 
	 * @param target {davinci.ve._Widget}
	 * 			The widget on which the user dropped the new widget.
	 * @param data {Array|Object}
	 * 			Data for the dropped widget. (This routine only looks for 'type' property)
	 * @param climb {boolean}
	 * 			Whether to climb the DOM looking for matches.
	 * @return an array of widgets which are possible valid parents for the dropped widget
	 * @type davinci.ve._Widget
	 */
	getAllowedTargetWidget: function(target, data, climb) {
		// get data for widget we are adding to page
		var getEnclosingWidget = widget.getEnclosingWidget,
			newTarget = target,
			allowedParentList = [],
			children = [];
		data = data.length ? data : [data];

		// 'data' may represent a single widget or an array of widgets.
		// Get data for all widgets, for use later in isAllowed().
		var _this = this;
		data.forEach(function(elem) {
			children.push({
				allowedParent: metadata.getAllowedParent(elem.type),
				classList: _this.getClassList(elem.type)
			});
		});

		do {
			var parentType = newTarget instanceof _Widget ?
					newTarget.type : newTarget._dvWidget.type;
			var parentClassList = this.getClassList(parentType);
			if(this.isAllowed(children, newTarget, parentType, parentClassList)){
				allowedParentList.push(newTarget);
			}
			newTarget = getEnclosingWidget(newTarget);
		} while (newTarget && climb);
		
		return allowedParentList;
	},
	
	// Returns 'true' if the dropped widget(s) is(are) allowed as a child of the
	// given parent.
	isAllowed: function(children, parent, parentType, parentClassList) {
		
		// returns 'true' if any of the elements in 'classes' are in 'arr'
		function containsClass(arr, classes) {
			return classes.some(function(elem) {
				return arr.indexOf(elem) !== -1;
			});
		}

		var allowedChild = metadata.getAllowedChild(parentType);
		
		// special case for HTML <body>
		if (parentType === "html.body") {
			allowedChild = ["ANY"];
		}
		
		// Cycle through children, making sure that all of them work for
		// the given parent.
		return children.every(function(child){
			var isAllowedChild = allowedChild[0] !== "NONE" &&
								 (allowedChild[0] === "ANY" ||
								  containsClass(allowedChild, child.classList));
			var isAllowedParent = child.allowedParent[0] === "ANY" ||
								  containsClass(child.allowedParent, parentClassList);
			return isAllowedChild && isAllowedParent;
		});
	},

	// returns an array consisting of 'type' and any 'class' properties
	getClassList: function(type) {
		var classList = metadata.queryDescriptor(type, 'class');
		if (classList) {
			classList = classList.split(/\s+/);
			classList.push(type);
			return classList;
		}
		return [type];
	},
	
	/**
	 * If showCandidateParents is true, then update the DIV that is being dragged around
	 * on the screen to show the list of possible parent widgets.
	 * If false, clear any existing list of possible parent widgets.
	 * 
	 * @param {object} params  object with following properties:
	 *    {string} widgetType  For example, 'dijit.form.Button'
	 *    {boolean} showCandidateParents  Whether the DIV being dragged around should show possible parents
	 *    {boolean} doCursor  Whether to show drop point cursor (for flow layouts)
	 *    {boolean} absolute  true if current widget will be positioned absolutely
	 *    {object} currentParent  if provided, then current parent widget for thing being dragged
	 */
	dragUpdateCandidateParents: function(params){
		var widgetType = params.widgetType,
			showCandidateParents = params.showCandidateParents,
			doCursor = params.doCursor, 
			absolute = params.absolute, 
			currentParent = params.currentParent;
		var allowedParentList = this._XYParent;
		if(!this._proposedParentWidget){
			this._proposedParentWidget = this._getDefaultParent(widgetType, allowedParentList, absolute, currentParent);
		}
		if(showCandidateParents || doCursor){
			this.highlightNewWidgetParent(this._proposedParentWidget);
		}

		var context = this._context;
		// NOTE: For CreateTool, the activeDragDiv is a DIV attached to dragClone
		// For SelectTool, the activeDragDiv is created by calling parentListDivCreate() (in this JS file)
		var activeDragDiv = context.getActiveDragDiv();
		var parentListDiv;
		if(activeDragDiv){
			// Palette.js stuffs in an extra DIV with class maqCandidateParents into DIV that is being dragged around by user
			var elems = dojo.query('.maqCandidateParents',activeDragDiv);
			if(elems.length==1){
				parentListDiv = elems[0];
			}
		}
		if(parentListDiv){
			if(showCandidateParents){
				// Don't recreate DIV with every mousemove if parent list is the same
				var same = true;
				if(this._lastProposedParentWidget != this._proposedParentWidget){
					same = false;
				}else if(typeof this._lastAllowedParentList == 'undefined' || this._lastAllowedParentList===null){
					same = false;
				}else if(this._lastAllowedParentList.length != allowedParentList.length){
					same = false;
				}else{
					for(var i=0; i<allowedParentList.length; i++){
						if(this._lastAllowedParentList[i] != allowedParentList[i]){
							same = false;
							break;
						}
					}
				}
				this._lastProposedParentWidget = this._proposedParentWidget;

				if(!same){
					var langObj = dojo.i18n.getLocalization("davinci.ve", "ve");
					var len;
					parentListDiv.innerHTML = '';
					if(typeof allowedParentList == 'undefined' || allowedParentList === null){
						this._lastAllowedParentList = null;
						len = 0;
					}else{
						this._lastAllowedParentList = allowedParentList.slice();	// clone the array
						len = allowedParentList.length;
						var headerDiv = dojo.create('div',{className:'maqCandidateParentsHeader'},parentListDiv);
						var listDiv = dojo.create('div',{className:'maqCandidateParentsList'},parentListDiv);
						var helpDiv = dojo.create('div',{className:'maqCandidateParentsHelp'},parentListDiv);
						var div;
						if(len === 0){
							headerDiv.innerHTML = langObj.noValidParents;
						}else if(len == 1){
							headerDiv.innerHTML = langObj.willBeChildOf;
							div = dojo.create('div', {
									className: 'maqCandidateListItem maqCandidateCurrent',
									innerHTML: widget.getLabel(allowedParentList[0])
								}, listDiv);
						}else{
							headerDiv.innerHTML = langObj.candidateParents;
							var s = '<table>';
							for(var i=allowedParentList.length-1, j=1; i >= 0; i--, j++){
								var className = 'maqCandidateListItem';
								if(allowedParentList[i] == this._proposedParentWidget){
									className += ' maqCandidateCurrent';
								}
								s += '<tr class="' + className +
									'"><td class="maqCandidateCheckedColumn">&rarr;</td><td class="maqCandidateNumberColumn">' + j +
									'</td><td class="maqCandidateParentColumn">' + widget.getLabel(allowedParentList[i]) +
									'</td></tr>';
							}
							s += '</table>';
							listDiv.innerHTML = s;
							helpDiv.innerHTML = langObj.toChangePress;
						}
					}
				}
			}else{
				parentListDiv.innerHTML = '';
				this._lastAllowedParentList = null;
			}
		}

		if(doCursor){
			var idx;
			for(var i=0; i<this._XYParent.length; i++){
				if(this._XYParent[i] === this._proposedParentWidget){
					idx = i;
					break;
				}
			}
			if(idx !== undefined){
				if(!this._cursorSpan){
					this._cursorSpan = dojo.create('span', {className:'editCursor'});
					this._timer = context.getGlobal().setInterval(function(node, context){
						dojo.toggleClass(node, 'editCursorBlink');
					}, 400, this._cursorSpan, context);
				}
				var parentNode = this._XYParent[idx].domNode;
				var refChild = this._XYRefChild[idx];
				var refChildNode = refChild ? refChild.domNode : null;
				var refAfter = this._XYRefAfter[idx];
				var cursorL, cursorT, cursorH, offsetParent;
				if(refChildNode){
					if(refAfter){
						if(refChildNode.nextSibling && refChildNode.nextSibling._dvWidget){
							var nextSibling = refChildNode.nextSibling;
							offsetParent = nextSibling.offsetParent;
							//parentNode.insertBefore(this._cursorSpan, nextSibling);
							var compStyle = dojo.style(nextSibling);
							cursorL = nextSibling.offsetLeft + parseInt(compStyle.borderLeftWidth) + parseInt(compStyle.paddingLeft);
							cursorT = nextSibling.offsetTop + parseInt(compStyle.borderTopWidth) + parseInt(compStyle.paddingTop);
						}else{
							offsetParent = refChildNode.offsetParent;
							//parentNode.appendChild(this._cursorSpan);
							var compStyle = dojo.style(refChildNode);
							cursorL = refChildNode.offsetLeft + refChildNode.offsetWidth + parseInt(compStyle.marginRight);
							cursorT = refChildNode.offsetTop + parseInt(compStyle.borderTopWidth) + parseInt(compStyle.paddingTop);
						}
					}else{
						offsetParent = refChildNode.offsetParent;
						//parentNode.insertBefore(this._cursorSpan, refChildNode);
						var compStyle = dojo.style(refChildNode);
						cursorL = refChildNode.offsetLeft + parseInt(compStyle.borderLeftWidth) + parseInt(compStyle.paddingLeft);
						cursorT = refChildNode.offsetTop + parseInt(compStyle.borderTopWidth) + parseInt(compStyle.paddingTop);
					}
					cursorH = compStyle.height;
				}else{
					offsetParent = parentNode.offsetParent;
					//parentNode.appendChild(this._cursorSpan);
					var compStyle = dojo.style(parentNode);
/*
					if(this._cursorSpan.offsetParent == parentNode){
						cursorL = parseInt(compStyle.borderLeftWidth) + parseInt(compStyle.paddingLeft);
						cursorT = parseInt(compStyle.borderTopWidth) + parseInt(compStyle.paddingTop);
					}else{
*/
						cursorL = parentNode.offsetLeft + parseInt(compStyle.borderLeftWidth) + parseInt(compStyle.paddingLeft);
						cursorT = parentNode.offsetTop + parseInt(compStyle.borderTopWidth) + parseInt(compStyle.paddingTop);
/*
					}
*/
					cursorH = '16px';
				}
				while(offsetParent && offsetParent.tagName != 'BODY'){
					cursorL += offsetParent.offsetLeft;
					cursorT += offsetParent.offsetTop;
					offsetParent = offsetParent.offsetParent;
				}
				var style = this._cursorSpan.style;
				style.height = cursorH;
				style.left = cursorL+'px';
				style.top = cursorT+'px';
				var body = parentNode.ownerDocument.body;
				body.appendChild(this._cursorSpan);
			}
		}
	
	},

	/**
	 * Choose a parent widget. For flow layout, default to nearest valid parent.
	 * For absolute layout, default to the current outer container widget (e.g., the BODY)
	 * 
	 * @param {string} widgetType  For example, 'dijit.form.Button'
	 * @param {[object]} allowedParentList  List of ancestor widgets of event.target that can be parents of the new widget
	 * @param {boolean} absolute  true if current widget will be positioned absolutely
	 * @param {object} currentParent  if provided, then current parent widget for thing being dragged
	 */
	_getDefaultParent: function(widgetType, allowedParentList, absolute, currentParent){
		var context = this._context;
		var proposedParentWidget;
		if(allowedParentList){
			var helper = widget.getWidgetHelper(widgetType);
			if(allowedParentList.length>1 && helper && helper.chooseParent){
				//FIXME: Probably should pass all params to helper
				proposedParentWidget = helper.chooseParent(allowedParentList);
			}else if (allowedParentList.length === 0){
				proposedParentWidget = null;
			}else{
				if(absolute && currentParent){
					proposedParentWidget = currentParent;
				}else{
					var last = allowedParentList.length - 1;
					proposedParentWidget = allowedParentList[last];
				}
			}
		}
		return proposedParentWidget;
	},
	
	/**
	 * Cleanup operations after drag operation is complete
	 */
	cleanup: function(){
		if(this._cursorSpan){
			this._cursorSpan.parentNode.removeChild(this._cursorSpan);
			this._cursorSpan = null;
		}
		if(this._timer){
			clearInterval(this._timer);
			this._timer = null;
		}
		var context = this._context;
		this.highlightNewWidgetParent(null);
		this._lastAllowedParentList = null;
	},
	
	/**
	 * During widget drag/drop creation, highlight the widget that would
	 * be the parent of the new widget
	 * @param {davinci.ve._Widget} newWidgetParent  Parent widget to highlight
	 */
	highlightNewWidgetParent: function(newWidgetParent){
		var context = this._context;
		if(newWidgetParent != this.newWidgetParent){
			if(this.newWidgetParent){
				this.newWidgetParent.domNode.style.outline = '';
			}
			this.newWidgetParent = newWidgetParent;
			if(newWidgetParent){
				//FIXME: This quick hack using 'outline' property is problematic:
				//(1) User won't see the brown outline on BODY
				//(2) If widget actually uses 'outline' property, it will get clobbered
				newWidgetParent.domNode.style.outline = '1px solid rgba(165,42,42,.7)'; // brown at .7 opacity
			}
		}
	},

	/**
	 * During drag operation, returns the widget that will become the parent widget
	 * when the drag operation ends (assuming nothing changes in mean time).
	 * @return {object|null}   Widget that is the new proposed parent widget
	 */
	getProposedParentWidget: function(){
		var ppw = null;
		if(this._XYParent){
			var idx = this._XYParent.indexOf(this._proposedParentWidget);
			if(idx >= 0){
				ppw = {};
				ppw.parent = this._XYParent[idx];
				ppw.refChild = this._XYRefChild[idx];
				ppw.refAfter = this._XYRefAfter[idx];
			}
		}
		return ppw;
	},

	/**
	 * During drag operation, sets the widget that will become the parent widget
	 * when the drag operation ends assuming nothing changes in mean time.
	 * @param {object|null} wdgt  Widget that is the new proposed parent widget
	 */
	setProposedParentWidget: function(wdgt){
		this._proposedParentWidget = wdgt;
	},


	/**
	 * During drag operation, returns the list of valid parent widgets at the 
	 * current mouse location.
	 * @return {array[object]}   Array of possible parent widgets at current (x,y)
	 */
	getProposedParentsList: function(){
		return this._XYParent;
	},
	
	/**
	 * Preparatory work before searching widget tree for possible parent
	 * widgets at a given (x,y) location
	 * @param {object} params  object with following properties:
	 * 		[array{object}] widgets  Array of widgets being dragged (can be empty array)
	 *      {object|array{object}} data  For widget being dragged, either {type:<widgettype>} or array of similar objects
	 *      {object} eventTarget  Node (usually, Element) that is current event.target (ie, node under mouse)
	 *      {object} position x,y properties hold current mouse location
	 *      {boolean} absolute  true if current widget will be positioned absolutely
	 *      {object} currentParent  if provided, then current parent widget for thing being dragged
	 * 		{object} rect  l,t,w,h properties define rectangle being dragged around
	 * 		{boolean} doSnapLines  whether to show dynamic snap lines
	 * 		{boolean} doFindParentsXY  whether to show candidate parent widgets
	 * @return {boolean} true if current (x,y) is different than last (x,y), false if the same.
	 */
	findParentsXYBeforeTraversal: function(params) {
		var widgets = params.widgets;
		var data = params.data;
		var eventTarget = params.eventTarget;
		var position = params.position;
		var absolute = params.absolute;
		var currentParent = params.currentParent;
		var rect = params.rect;
		var doFindParentsXY = params.doFindParentsXY;
		this._XYParent = [];
		this._XYRefChild = [];
		this._XYRefAfter = [];
		var bodyWidget = eventTarget.ownerDocument.body._dvWidget;
		if(absolute && currentParent && currentParent != bodyWidget){
			this._XYParent.push(currentParent);
			this._XYRefChild.push(widgets[0]);
			this._XYRefAfter.push(true);
		}		
		if(typeof this.findParentsXYLastPosition == 'undefined'){
			this.findParentsXYLastPosition = {};
		}

		var last = this.findParentsXYLastPosition;
		if(position.x === last.x && position.y === last.y){
			return false;
		}else{
			last.x = position.x;
			last.y = position.y;
			return true;
		}
	},
	
	/**
	 * If this widget overlaps given x,y position, then add to
	 * list of possible parents at current x,y position
	 * @param {object} params  object with following properties:
	 *    {object|array{object}} data  For widget being dragged, either {type:<widgettype>} or array of similar objects
	 *    {object} widget  widget to check (dvWidget)
	 *    {object} position  object with properties x,y (in page-relative coords)
	 *    {boolean} doCursor  whether to show drop cursor (when dropping using flow layout)
	 *    {string|undefined} beforeAfter  either 'before' or 'after' or undefined (which means default behavior)
	 */
	findParentsXY: function(params) {
		var data = params.data,
			wdgt = params.widget,
			position = params.position,
			doCursor = params.doCursor,
			beforeAfter = params.beforeAfter;
		var domNode = wdgt.domNode;
		var x = position.x;
		var y = position.y;
		var w = domNode.offsetWidth;
		var h = domNode.offsetHeight;
		var l = domNode.offsetLeft;
		var t = domNode.offsetTop;
		var offsetParent = domNode.offsetParent;
		while(offsetParent && offsetParent.tagName != 'BODY'){
			l += offsetParent.offsetLeft;
			t += offsetParent.offsetTop;
			offsetParent = offsetParent.offsetParent;
		}
		var r = l + w;
		var b = t + h;
		if(x >= l && x <= r && y >= t && y <= b){
			var allowedParents = this.getAllowedTargetWidget(wdgt, data, false);
			if(allowedParents.length === 1){
				var children = wdgt.getChildren();
				var childData = [];
				for(var i=0; i<children.length; i++){
					var child = children[i];
					var node = child.domNode;
					if(xOffset === undefined){
						var xOffset = 0,
							yOffset = 0;
						var offsetParent = node.offsetParent;
						while(offsetParent && offsetParent.tagName != 'BODY'){
							xOffset += offsetParent.offsetLeft;
							yOffset += offsetParent.offsetTop;
							offsetParent = offsetParent.offsetParent;
						}
					}
					var w = node.offsetWidth;
					var h = node.offsetHeight;
					var l = node.offsetLeft + xOffset;
					var t = node.offsetTop + yOffset;
					var r = l + w;
					var b = t + h;
					var c = l + w/2;
					childData.push({l:l, t:t, r:r, b:b, c:c});
				}
				var refChild, refAfter, biggestY;
				for(var i=0; i<childData.length; i++){
					var cd = childData[i];
					var child = children[i];
					if(x >= cd.l && x <= cd.r && y >= cd.t && y <= cd.b){
						// If mouse is over one of the children, then
						// insert either before or after that child (and jump out of loop)
						refChild = child;
						refAfter = x >= cd.c ? true : false;
						break;
					}
					if(i === 0){
						// If there is at least one child, set default solution
						// to being either before or after that first child
						refChild = child;
						refAfter = (y > cd.b || x >= cd.c) ? true : false;
						biggestY = cd.b;
					}else if((y >= cd.t || y >= biggestY) && x >= cd.l){
						// Else if mouse is below top of this child or further down page than any previous child
						// and mouse isn't to left of this child,
						// then this child is a candidate refChild
						refChild = child;
						refAfter = (y > cd.b || x >= cd.c) ? true : false;
					}else if(y >= biggestY && y >= cd.b){
						// Else if mouse is below bottom of this child and all previous childs
						// then this child is candidate refChild
						refChild = child;
						refAfter = true;
					}
					if(cd.b > biggestY) {
						biggestY = cd.b;
					}
				}
				this._XYParent.push(wdgt);
				this._XYRefChild.push(refChild);
				refAfter = beforeAfter === 'after' ? true : (beforeAfter === 'before' ? false : refAfter);
				this._XYRefAfter.push(refAfter);
			}
		}
	},
	
	/**
	 * Wrap-up work after searching widget tree for possible parent
	 * widgets at a given (x,y) location
	 */
	findParentsXYAfterTraversal: function() {
		this.findParentsXYLastPosition = {};
	},
	
    /**
     * Create a floating DIV that will hold the list of proposed parent widgets
	 * {string} widgetType  Type of widget (e.g., 'dijit.form.Button')
	 * @param {object} params  object with following properties:
	 *    {string} widgetType  widget type (e.g., 'dijit.form.Button')
	 *    {boolean} absolute  true if current widget will be positioned absolutely
	 *    {boolean} doCursor  whether to show drop cursor (when dropping using flow layout)
	 *    {string|undefined} beforeAfter  either 'before' or 'after' or undefined (which means default behavior)
	 *    {object} currentParent  if provided, then current parent widget for thing being dragged
     */
    parentListDivCreate: function(params){
    	var widgetType = params.widgetType, 
			absolute = params.absolute, 
			doCursor = params.doCursor, 
			beforeAfter = params.beforeAfter, 
    		currentParent = params.currentParent;
		var context = this._context;
    	if(!widgetType){
    		return;
    	}
        var userdoc = context.getDocument();	// inner document = user's document
        this._oldActiveElement = document.activeElement;
        //TODO it is possible that giving focus to defaultView will break the PageEditor split view mode. Needs investigation.
        //JF: I don't think this will break split view. This code is only activated during drag operations
        //on the canvas, and drag operations on canvas should have all focus things on the canvas.
        userdoc.defaultView.focus();	// Make sure the userdoc is the focus object for keyboard events
        this._keyDownHandler = dojo.connect(userdoc, "onkeydown", dojo.hitch(this, function(args, evt){
        	var widgetType = args[0];
        	var absolute = args[1];
        	var doCursor = args[2];
        	var beforeAfter = args[3];
        	var currentParent = args[4];
        	this.onKeyDown(evt, widgetType, absolute, doCursor, beforeAfter, currentParent);
        }, [widgetType, absolute, doCursor, beforeAfter, currentParent]));
        this._keyUpHandler = dojo.connect(userdoc, "onkeyup", dojo.hitch(this, function(args, evt){
        	var widgetType = args[0];
        	var absolute = args[1];
        	var doCursor = args[2];
        	var beforeAfter = args[3];
        	var currentParent = args[4];
        	this.onKeyUp(evt, widgetType, absolute, doCursor, beforeAfter, currentParent);
        }, [widgetType, absolute, doCursor, beforeAfter, currentParent]));
 		var body = document.body;	// outer document = Maqetta app
		var parentListDiv = this._parentListDiv = dojo.create('div', {
			className:'maqParentListDiv', 
			style:'position:absolute;z-index:1000; opacity:.7;pointer-events:none;'}, 
			body);
		context.setActiveDragDiv(parentListDiv);
		// Downstream logic stuffs the list of candidate parents into DIV with class 'maqCandidateParents'
		dojo.create('div', {className:'maqCandidateParents'}, parentListDiv);
		return parentListDiv;
    },
	
    /**
     * Return the floating DIV that will hold the list of proposed parent widgets
     * @returns {object}  DIV's domNode
     */
    parentListDivGet: function(){
        return this._parentListDiv;
    },
    
    /**
     * Delete the floating DIV that held the list of proposed parent widgets
     */
   parentListDivDelete: function(){
	   var context = this._context;
	   var parentListDiv = this._parentListDiv;
	   if(parentListDiv){
		   if(this._oldActiveElement){
			   this._oldActiveElement.focus();
			   this._oldActiveElement = null;
		   }
		   dojo.disconnect(this._keyDownHandler);
		   dojo.disconnect(this._keyUpHandler);
		   this._keyDownHandler = this._keyUpHandler = null;
		   var parentNode = parentListDiv.parentNode;
		   parentNode.removeChild(parentListDiv);
		   context.setActiveDragDiv(null);
		   this._parentListDiv = null;
	   }
    },
    
    _keyEventDoUpdate: function(widgetType, absolute, doCursor, beforeAfter, currentParent){
		// Under certain conditions, show list of possible parent widgets
		var showParentsPref = this._context.getPreference('showPossibleParents');
		var showCandidateParents = (!showParentsPref && this._spaceKeyDown) || (showParentsPref && !this._spaceKeyDown);
		this.dragUpdateCandidateParents({widgetType:widgetType,
			showCandidateParents:showCandidateParents, 
			doCursor:doCursor, 
			beforeAfter:beforeAfter, 
			absolute:absolute, 
			currentParent:currentParent});
    },
    
	onKeyDown: function(event, widgetType, absolute, doCursor, beforeAfter, currentParent){
		dojo.stopEvent(event);
		if(event.keyCode==32){	// 32=space key
			this._spaceKeyDown = true;
		}else{
			this._processKeyDown(event.keyCode);
		}
		this._keyEventDoUpdate(widgetType, absolute, doCursor, beforeAfter, currentParent);
	},

	onKeyUp: function(event, widgetType, absolute, doCursor, beforeAfter, currentParent){
		dojo.stopEvent(event);
		if(event.keyCode==32){	// 32=space key
			this._spaceKeyDown = false;
		}
		this._keyEventDoUpdate(widgetType, absolute, doCursor, beforeAfter, currentParent);
	},
	
	/**
	 * Update currently proposed parent widget based on latest keydown event
	 * 
	 * @param {number} keyCode  The keyCode for the key that the user pressed
	 */
	_processKeyDown: function(keyCode){
		if(keyCode>=49 && keyCode<=57){		// 1-9
			var context = this._context;
			var proposedParentsList = this.getProposedParentsList();
			if(proposedParentsList.length > 1){
				// Number character: select parent that has the given number
				// Note that the presentation is 1-based (versus 0-based) and backwards
				var index = proposedParentsList.length - (keyCode - 48);
				if(index >= 0){
					this.setProposedParentWidget(proposedParentsList[index]);
				}
			}
		}
	},
	
	isSpaceKeyDown: function(){
		return this._spaceKeyDown;
	}
});
});
