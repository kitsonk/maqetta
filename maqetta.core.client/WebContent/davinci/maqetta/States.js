// Duplicate of workspace/maqetta/maqetta.js for use by page editor.
// Created this cloned version to overcome loader/build conflicts 
// if page editor and runtime (possibly) using different versions of Dojo

// Code below is looking for dojo at davinci.dojo. Don't ask why.

if ( typeof davinci === "undefined" ) { davinci = {}; }
require(["dojo/_base/connect"], function(connect){
davinci.dojo = dojo;

davinci.maqetta = davinci.maqetta || {};
davinci.maqetta.States = function(){};
davinci.maqetta.States.prototype = {

	NORMAL: "Normal",
	ATTRIBUTE: "dvStates",

	/**
	 * Returns the array of states declared by the widget, plus the implicit normal state. 
	 */ 
	getStates: function(widget, associative){ 
		widget = this._getWidget(widget); 
		var names = associative ? {"Normal": "Normal"} : ["Normal"];
		var states = widget && widget.states;
		if (states) {
			for (var name in states) {
				if (states[name].origin && name != "Normal") {
					if (associative) {
						names[name] = name;
					} else {
						names.push(name);
					}
				}
			}
		}
		return names;
	},
	
	_getWidget: function(widget) {
		if (!widget) {
			var doc = this.getDocument();
			widget = doc && doc.body;
		}
		return widget;
	},
	
	_updateSrcState: function (widget)
	{
		
	},
	
	/**
	 * Returns true if the widget declares the state, false otherwise.
	 */
	hasState: function(widget, state, property){ 
		if (arguments.length < 2) {
			state = arguments[0];
			widget = undefined;
		}
		widget = this._getWidget(widget);
		return !!(widget && widget.states && widget.states[state] && (property || widget.states[state].origin));
	},

	/**
	 * Returns the current state of the widget.
	 */
	getState: function(widget){ 
		widget = this._getWidget(widget);
		return widget && widget.states && widget.states.current;
	},
	
	/**
	 * Sets the current state of the widget.  
	 * Subscribe using davinci.states.subscribe("/davinci/states/state/changed", callback).
	 */
	setState: function(widget, newState, updateWhenCurrent, _silent){
		if (arguments.length < 2) {
			newState = arguments[0];
			widget = undefined;
		}
		widget = this._getWidget(widget);
		if (!widget || !widget.states || (!updateWhenCurrent && widget.states.current == newState)) {
			return;
		}
		var oldState = widget.states.current;
		
		if (this.isNormalState(newState)) {
			if (!widget.states.current) { return; }
			delete widget.states.current;
			newState = undefined;
		} else {
			widget.states.current = newState;
		}
		if (!_silent) {
			this.publish("/davinci/states/state/changed", [{widget:widget, newState:newState, oldState:oldState}]);
		}
		this._updateSrcState (widget);
		
	},
	
	/**
	 * If the current state is not Normal, force a call to setState
	 * so that styling properties get reset for a subtree.
	 */
	resetState: function(widget){
		var currentState = this.getState(widget.getContext().rootWidget);
		if(!this.isNormalState(currentState)){
			this.setState(widget, currentState, true/*updateWhenCurrent*/, false /*silent*/);
		}		
	},
	
	isNormalState: function(state) {
		if (arguments.length == 0) {
			state = this.getState();
		}
		return !state || state == this.NORMAL;
	},
	
	getStyle: function(widget, state, name) {
		var style;
		widget = this._getWidget(widget);
		if (arguments.length == 1) {
			state = this.getState();
		}
		// return all styles specific to this state
		style = widget && widget.states && widget.states[state] && widget.states[state].style;
		if (arguments.length > 2) { 
			style = style && widget.states[state].style[name];
		}
		return style;
	},

	hasStyle: function(widget, state, name) {
		widget = this._getWidget(widget);

		if (!widget || !name) { return; }
		
		return widget.states && widget.states[state] && widget.states[state].style && widget.states[state].style.hasOwnProperty(name);
	},

	setStyle: function(widget, state, style, value, silent) {
		widget = this._getWidget(widget);

		if (!widget || !style) { return; }
			
		if (typeof style == "string") {
			var name = style;
			style = {};
			style[name] = value;
		}

		widget.states = widget.states || {};
		widget.states[state] = widget.states[state] || {};
		widget.states[state].style = widget.states[state].style || {};
		
		for (var name in style) {
			value = style[name];
			if (typeof value != "undefined" && value !== null) {
				value = this._getFormattedValue(name, value);
				widget.states[state].style[name] = value;
			}		
		}
			
		if (!silent) {
			this.publish("/davinci/states/state/style/changed", [{widget:widget, state:state, style:style}]);
		}
		this._updateSrcState (widget);
	},
	
	_convertStyleName: function(name) {
		if(name.indexOf("-") >= 0){
			// convert "property-name" to "propertyName"
			var names = name.split("-");
			name = names[0];
			for(var i = 1; i < names.length; i++){
				var n = names[i];
				name += (n.charAt(0).toUpperCase() + n.substring(1));
			}
		}
		return name;
	},
	
	_DYNAMIC_PROPERTIES: { width:1, height:1, top:1, right:1, bottom:1, left:1 },
	
	_getFormattedValue: function(name, value) {
		//FIXME: This code needs to be analyzed more carefully
		// Right now, only checking six properties which might be set via dynamic
		// drag actions on canvas. If just a raw number value, then add "px" to end.
		if(name in this._DYNAMIC_PROPERTIES){
			if(typeof value != 'string'){
				return value+"px";
			}
			var trimmed_value = require("dojo/_base/lang").trim(value);
			// See if value is a number
			if(/^[-+]?[0-9]*\.?[0-9]+$/.test(trimmed_value)){
				value = trimmed_value+"px";
			}
		}
		return value;			
	},
	
	_resetAndCacheNormalStyle: function(widget, node, style, newState) {
		var normalStyle = this.getStyle(widget, undefined);
		
		// Reset normal styles
		for (var name in normalStyle) {
			var convertedName = this._convertStyleName(name);
			var previousValue = this._getFormattedValue(name, davinci.dojo.style(node, convertedName));
			if (previousValue !== normalStyle[name]) {
				davinci.dojo.style(node, convertedName, normalStyle[name]);
			}
		}

		// Remember style values from the normal state
		if (!this.isNormalState(newState)) {
			for (var name in style) {
				if(!this.hasStyle(widget, undefined, name)) {
					var convertedName = this._convertStyleName(name);
					var value = this._getFormattedValue(name, davinci.dojo.style(node, convertedName));
					this.setStyle(widget, undefined, name, value, true);
				}
			}
		}
	},
	
	_update: function(widget, newState, oldState) {
		widget = this._getWidget(widget);
		if (!widget) return;
		
		var node = widget.domNode || widget;

		var style = this.getStyle(widget, newState);
		
		this._resetAndCacheNormalStyle(widget, node, style, newState);

		// Apply new style
		for (var name in style) {
			var convertedName = this._convertStyleName(name);
			davinci.dojo.style(node, convertedName, style[name]);
		}
		
		//FIXME: This is Dojo-specific. Other libraries are likely to need a similar hook.
		var dijitWidget, parent;
		if(node.id && node.ownerDocument && node.ownerDocument.defaultView && node.ownerDocument.defaultView.dijit){
			dijitWidget = node.ownerDocument.defaultView.dijit.byId(node.id);
		}
		if(dijitWidget && dijitWidget.getParent){
			parent = dijitWidget.getParent();
		}
		if(parent && parent.resize){
			parent.resize();
		}else if(dijitWidget && dijitWidget.resize){
			dijitWidget.resize();
		}
	},
		
	isContainer: function(widget) {
		var result = false;
		if (widget) {
			var doc = this.getDocument();
			if (widget === (doc && doc.body) || (widget.domNode && widget.domNode.tagName && widget.domNode.tagName == "BODY")) {
				result = true;
			}
		}
		return result;
	},
	
	getContainer: function() {
		return this._getWidget();
	},
	
	/**
	 * Adds a state to the list of states declared by the widget.  
	 * Subscribe using davinci.states.subscribe("/davinci/states/state/added", callback).
	 */
	add: function(widget, state){ 
		if (arguments.length < 2) {
			state = arguments[0];
			widget = undefined;
		}
		widget = this._getWidget(widget);
		if (!widget || this.hasState(widget, state)) {
			//FIXME: This should probably be an error of some sort
			return;
		}
		widget.states = widget.states || {};
		widget.states[state] = widget.states[state] || {};
		widget.states[state].origin = true;
		this.publish("/davinci/states/state/added", [{widget:widget, state:state}]);
		this._updateSrcState (widget);
	},
	
	/** 
	 * Removes a state from the list of states declared by the widget.  
	 * Subscribe using davinci.states.subscribe("/davinci/states/state/removed", callback).
	 */
	remove: function(widget, state){ 
		if (arguments.length < 2) {
			state = arguments[0];
			widget = undefined;
		}
		widget = this._getWidget(widget);
		if (!widget || !this.hasState(widget, state)) {
			return;
		}
		
		var currentState = this.getState(widget);
		if (state == currentState) {
			this.setState(widget, undefined);
		}
		
		delete widget.states[state].origin;
		if (this._isEmpty(widget.states[state])) {
			delete widget.states[state];
		}
		this.publish("/davinci/states/state/removed", [{widget:widget, state:state}]);
		this._updateSrcState (widget);
	},
	
	/**
	 * Renames a state in the list of states declared by the widget.
	 * Subscribe using davinci.states.subscribe("/davinci/states/renamed", callback).
	 */
	rename: function(widget, oldName, newName, property){ 
		if (arguments.length < 3) {
			newName = arguments[1];
			oldName = arguments[0];
			widget = undefined;
		}
		widget = this._getWidget(widget);
		if (!widget || !this.hasState(widget, oldName, property) || this.hasState(widget, newName, property)) {
			return false;
		}
		widget.states[newName] = widget.states[oldName];
		delete widget.states[oldName];
		if (!property) {
			this.publish("/davinci/states/state/renamed", [{widget:widget, oldName:oldName, newName:newName}]);
		}
		this._updateSrcState (widget);
		return true;
	},

	/**
	 * Returns true if the widget is set to visible within the current state, false otherwise.
	 */ 
	isVisible: function(widget, state){ 
		if (arguments.length == 1) {
			state = this.getState();
		}
		widget = this._getWidget(widget);
		if (!widget) return;
		// FIXME: The way the code is now, sometimes there is an "undefined" property
		// within widget.states. That code seems somewhat accidental and needs
		// to be studied and cleaned up.
		var domNode = (widget.domNode || widget);
		var isNormalState = (typeof state == "undefined" || state == "undefined");
		if(isNormalState){
			return domNode.style.display != "none";
		}else{
			if(widget.states && widget.states[state] && widget.states[state].style && typeof widget.states[state].style.display == "string"){
				return widget.states[state].style.display != "none";
			}else{
				return domNode.style.display != "none";
			}
		}
	},
	
	_isEmpty: function(object) {
		for (var name in object) {
			if (object.hasOwnProperty(name)) {
				return false;
			}
		}
		return true;
	},
	
	serialize: function(widget) {
		if (!widget) return;
		var value = "";
		if (widget.states) {
			var states = require("dojo/_base/lang").clone(widget.states);
			delete states["undefined"];
			if (!this._isEmpty(states)) {
				value = JSON.stringify(states);
				// Escape single quotes that aren't already escaped
				value = value.replace(/(\\)?'/g, function($0, $1){ 
					return $1 ? $0 : "\\'";
				});
				// Replace double quotes with single quotes
				value = value.replace(/"/g, "'");
			}
		}
		return value;
	},
	
	deserialize: function(states) {
		if (typeof states == "string") {
			// Replace unescaped single quotes with double quotes, unescape escaped single quotes
			states = states.replace(/(\\)?'/g, function($0, $1){ 
					return $1 ? "'" : '"';
			});
			states = JSON.parse(states);
		}
		return states;
	},
	
	store: function(widget, states) {
		if (!widget || !states) return;
		
		this.clear(widget);
		widget.states = states = this.deserialize(states);
		this.publish("/davinci/states/stored", [{widget:widget, states:states}]);
	},
		
	retrieve: function(widget) {
		if (!widget) return;
		
		var node = widget.domNode || widget;
		var states = node.getAttribute(this.ATTRIBUTE);
		return states;
	},

	clear: function(widget) {
		if (!widget || !widget.states) return;
		var states = widget.states;
		delete widget.states;
		this.publish("/davinci/states/cleared", [{widget:widget, states:states}]);
	},
	
	getDocument: function() {
		return document;
	},
	
	_shouldInitialize: function() {
		var windowFrameElement = window.frameElement;
		var isDavinciEditor = top.davinci && top.davinci.Runtime && (!windowFrameElement || windowFrameElement.dvContext);
		return !isDavinciEditor;
	},

	publish: function(/*String*/ topic, /*Array*/ args) {
		try {
			return connect.publish(topic, args);
		} catch(e) {
			console.error(e);
		}
	},
	
	subscribe: function(/*String*/ topic, /*Object|null*/ context, /*String|Function*/ method){
		return connect.subscribe(topic, context, method);
	},
	
	unsubscribe: function(handle){
		return connect.unsubscribe(handle);
	}, 

	_getChildrenOfNode: function(node) {
		var children = [];
		var child = node.firstChild;
		while(child) {
			if (child.nodeType == 1) {
				children.push(child);
			}
			child = child.nextSibling;
		}
		return children;
	},
	
	_getWidgetByNode: function(node) {
		var widget = node;
		if (typeof dijit != "undefined") {
			widget = node.widgetid ? dijit.byId(node.widgetid) : (dijit.byNode(node) || node);
		}
		return widget;
	},
	
	initialize: function() {
	
		if (!this.subscribed && this._shouldInitialize()) {
		
			this.subscribe("/davinci/states/state/changed", function(e) { 
				var children = davinci.states._getChildrenOfNode(e.widget.domNode || e.widget);
				while (children.length) {
					var child = children.shift();
					var childWidget = davinci.states._getWidgetByNode(child);
					if (!davinci.states.isContainer(childWidget)) {
						children = children.concat(davinci.states._getChildrenOfNode(childWidget.domNode || childWidget));				
					}
					davinci.states._update(childWidget, e.newState, e.oldState);
				}
			});
			
			this.subscribed = true;
		}
	}
};

davinci.states = new davinci.maqetta.States();

(function(){

	if (davinci.states._shouldInitialize()) {
	
		davinci.states.initialize();
		
		// Patch the dojo parse method to preserve states data
		if (typeof require != "undefined") {
			require(["dojo/_base/lang", "dojo/query", "dojo/domReady!"], function(lang, query) {
				var cache = {}; // could be local to hook function?

				// hook main dojo.parser (or dojox.mobile.parser, which also
				// defines "dojo.parser" object)
				// Note: Uses global 'dojo' reference, which may not work in the future
				var hook = function(parser) {
					var parse = parser.parse;
					dojo.parser.parse = function() {
						_preserveStates(cache);
						var results = parse.apply(this, arguments);
						_restoreStates(cache);
						return results;
					};
				};
				// only include the regular parser if the mobile parser isn't available
				var parser = lang.getObject("dojox.mobile.parser.parse");
				if (!parser) {
					require(["dojo/parser"], hook);
				} else {
					hook.apply(parser);
				}
			
				// preserve states specified on widgets
				var _preserveStates = function (cache) {
					var doc = davinci.states.getDocument();
	
					// Preserve the body states directly on the dom node
					var states = davinci.states.retrieve(doc.body);
					if (states) {
						cache.body = states;
					}
	
					// Preserve states of children of body in the cache
					query("*", doc).forEach(function(node){
						var states = davinci.states.retrieve(node);
						if (states) {
							if (!node.id) {
								node.id = _getTemporaryId(node);
							}
							if (node.tagName != "BODY") {
								cache[node.id] = states;
							}
						}
					});
				};
	
				// restore widget states from cache
				var _restoreStates = function (cache) {
					var doc = davinci.states.getDocument(),
						currentStateCache = [];
					for(var id in cache){
						var widget = id == "body" ? doc.body : dijit.byId(id) || dojo.byId(id);
						if (!widget) {
							console.error("States: Failed to get widget by id: ", id);
						}
						var states = davinci.states.deserialize(cache[id]);
						delete states.current; // always start in normal state for runtime
						davinci.states.store(widget, states);
					}
				};
					
				var _getTemporaryId = function (type) {
					if (!type) {
						return undefined;
					}
					if (type.domNode) { // widget
						type = type.declaredClass;
					} else if (type.nodeType === 1) { // Element
						type = (type.getAttribute("dojoType") || type.nodeName.toLowerCase());
					}
					type = type ? type.replace(/\./g, "_") : "";
					return dijit.getUniqueId(type);
				};
			});
		}
	}
})();

// Bind to watch for overlay widgets at runtime.  Dijit-specific, at this time
if (!davinci.Workbench && typeof dijit != "undefined"){
	davinci.states.subscribe("/davinci/states/state/changed", function(args) {
		var w;
		if (args.newState && !args.newState.indexOf("_show:")) {
			w = dijit.byId(args.newState.substring(6));
			w && w.show && w.show();
		} else if (args.oldState && !args.oldState.indexOf("_show:")) {
			w = dijit.byId(args.oldState.substring(6));
			w && w.hide && w.hide();
		}
	});
}
});
