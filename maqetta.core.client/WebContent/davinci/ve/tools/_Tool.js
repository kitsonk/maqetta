define(["dojo/_base/declare",
        "davinci/ve/widget",
        "davinci/ve/metadata"], function(declare, widget, metadata){

return declare("davinci.ve.tools._Tool", null, {

	_getTarget: function(){
		return this._target;
	},

	_setTarget: function(target){
		
		if(!this._feedback){
			this._feedback = this._context.getDocument().createElement("div");
			this._feedback.className = "editFeedback";
			this._feedback.style.position = "absolute";
			/* ORIGINAL CODE
			this._feedback.style.zIndex = "99"; // below Focus (zIndex = "100")
			*/
			dojo.style(this._feedback, "opacity", 0.1);
		}

		if(target == this._feedback){
			return;
		}

		var containerNode = this._context.getContainerNode();
		var w;
		
		while(target && target != containerNode){
			w = widget.getEnclosingWidget(target);
			// Not sure when w.getContext() won't be true. Maybe that check deals with
			// widgets that are either not completely ready or in process of being deleted?
			// If anyone knows answer, please update this comment.
			if(w && !w.getContext()){
				target = w.domNode.parentNode;
				w = null;
			}else if (w && davinci.ve.metadata.queryDescriptor(w.type, "enablePointerEvents")) {
				// By default, this function posts an overlay DIV over primitive widgets to mask/capture 
				// mouse/touch/pointer events  that might otherwise trigger a widget's own interactive logic, 
				// such as bringing up popup menus or onhover styling.
				// The "enablePointerEvents" descriptor property says don't mask/capture these events
				// and let those events go right through into the underlying widget.
				w = null;
				break;
			}else{
				// Flow typically comes to here. The following check determines if
				// current widget is a container, which means it can contain other widgets.
				// If a container, then don't put editFeedback overlay over this DOM node
				// because we want user to be able to click-select on child widgets,
				// (unless the "isControl" metadata override is set for this widget type).
				if (w && w.getContainerNode()) {
					// Some Dijit widgets inherit from dijit._Container even those
					// they aren't really meant to contain child widgets.
					// "isControl" metadata flag overrides and says this is really 
					// a primitive widget not a container widget.
					if (!davinci.ve.metadata.queryDescriptor(w.type, "isControl")) {
						w = null;
					}
				}
				break;
			}
		}

		if(w){
			var node = w.getStyleNode();
			var box = this._context.getDojo().position(node, true);
			box.l = box.x;
			box.t = box.y;

			var domNode = w.domNode;
			var parentNode = domNode.parentNode;
			this._updateTarget();
			
			//Calculate zIndex -- we want a zIndex at least equal to the maximum
			//zIndex of domNode and it's descendants. This comes into play
			//with HorizontalSlider/VerticalSlider where the progress bar and the 
			//knob on the progress bar have higher zIndex values than the slider
			//itself.
			this._feedback.style.zIndex = this._getMaxZIndex(domNode);
			
			//Insert element
			parentNode.insertBefore(this._feedback,domNode.nextSibling);
			
			this._target = w;
		}else{
			if(this._feedback.parentNode){
				this._feedback.parentNode.removeChild(this._feedback);
			}
			this._target = null;
		}
	},
	
	_getMaxZIndex: function(startNode) {
		//We want to look at the computed zIndex of the startNode and all
		//descendant's of startNode to find the maximum zIndex value
		var max_zIndexStr = dojo.style(startNode, "zIndex");
		dojo.query("*", startNode).forEach(function(node){
			var node_zIndexStr = dojo.style(node, "zIndex");
			var node_zIndexNumber = Number(node_zIndexStr);
			var max_zIndexNumber = Number(max_zIndexStr);
			if (!isNaN(node_zIndexNumber)) {
				//Our node's zIndex maps to a valid number
				if (isNaN(max_zIndexNumber)) {
					//Our max is not a valid number, so replace it
					max_zIndexStr = node_zIndexStr;
				} else if (node_zIndexNumber > max_zIndexNumber) {
					//Both our node and max zIndices map to valid numbers,
					//so replace max with node zIndex if greater
					max_zIndexStr = node_zIndexStr;
				}
			}
			//We don't care about the else case (where node's zIndex does not represent a number)
		});

		return max_zIndexStr;
	},
	
	// Calculate bounds for "target" overlay rectangle
	_updateTarget: function(){
		if(this._feedback && this._target){
			var domNode = this._target.domNode;
			this._feedback.style.left = domNode.offsetLeft+"px";
			this._feedback.style.top = domNode.offsetTop+"px";
			this._feedback.style.width = domNode.offsetWidth+"px";
			this._feedback.style.height = domNode.offsetHeight+"px";			
		}
	}

});
});