define([
	"dojo/_base/declare",
	"dojo/_base/lang",
	"dojo/_base/connect",
	"dojo/dom-style",
	// XXX TODO This file (and others) makes too much use of style.set().  Need
	//   to refactor this and create one (or more) CSS classes that can be set
	//   on the outermost element of this widget -- setting/unsetting this class
	//   then sets the proper CSS on interior elements.
	"dojo/dom",
	"dojo/dom-class",
	"dojo/data/ItemFileReadStore",
	"dijit/registry",
	"davinci/ve/input/SmartInput",
	"davinci/ve/widget",
	"davinci/ve/commands/ModifyCommand",
	"davinci/commands/OrderedCompoundCommand",
	"davinci/model/Path",
	"dijit/Dialog",
	"dijit/layout/ContentPane",	
	"dijit/form/Button",
    "dijit/Tree",
	"system/resource",
	"dojo/i18n!dijit/nls/common",
	"dojo/i18n!../../dojox/nls/dojox",
	"dojox/form/DropDownSelect"	// used in template
], function(
	declare,
	lang,
	connect,
	style,
	dom,
	domClass,
	ItemFileReadStore,
	registry,
	SmartInput,
	Widget,
	ModifyCommand,
	OrderedCompoundCommand,
	Path,
	Dialog,
	ContentPane,
	Button,
	Tree,
	resource,
	commonNls,
	dojoxNls
	/*DropDownSelect*/
) {

return declare(SmartInput, {

	displayOnCreate: "true",
	
	delimiter: ", ",
	
	multiLine: "true",
	supportsHTML: "false", 
	//helpText:  'First line is column headers separated by commons all following lines are data for those columns.',

	helpText:  'If the CSV data format is selected enter text in the format: first line is column headers separated by commas all following lines are data for those columns.'+
    		   ' If data file from workspace is selected chose a json item file using the file explore folder.',


	_getContainer: function(widget){
		while(widget){
			if ((widget.isContainer || widget.isLayoutContainer) && widget.declaredClass != "dojox.layout.ScrollPane"){
				return widget;
			}
			widget = Widget.getParent(widget); 
		}
		return undefined;
	},
	
	_getEditor: function() {
		return top.davinci && top.davinci.Runtime && top.davinci.Runtime.currentEditor;
	},
	
	_getContext: function() {
		var editor = this._getEditor();
		return editor && (editor.getContext && editor.getContext() || editor.context);
	},

	
	refreshStoreView: function(){
		var textArea = registry.byId("davinciIleb"),
			value ='';
		this._widget.dijitWidget.store.fetch({
			query: this.query, // XXX No `query` func on this obj
			queryOptions:{deep:true}, 
			onComplete: function(items) {
				items.forEach(function(item){
					value +=  item.label[0];
					if (item.moveTo){
						value +=  ', ' + item.moveTo[0];
					}
					value += '\n';
				});
				this._data = value;
				textArea.attr('value', String(value));
			}.bind(this)
		});
	},
	
	onOk: function(e){
		
		if (this._fileSelectionDialog){
			// file selection dialog is active so don't close inline edit
			return;
		}
		if (this._dataStoreType === 'dummyData'){
			this.updateWidget();
		} else if (this._dataStoreType === 'file'){
			this._format = this.getFormat();
	    	this.updateWidgetForUrlStore();
		} else if (this._dataStoreType === 'url'){
			this._format = this.getFormat();
	    	this.updateWidgetForUrlStore(); 
		}
	    this.hide(); 
	},
	
	hide: function(){
        this.inherited(arguments, [ true ]); // we already updated the widget so just do a hide like cancel
    },
	
    updateWidget: function() {
        
        var context = this._getContext();
        var widget = this._widget;
        	
    	var storeCmd = this.updateStore();
        var command = new ModifyCommand(widget, null, null, context);
        var compoundCommand = new OrderedCompoundCommand();
        compoundCommand.add(storeCmd);
        compoundCommand.add(command);
        context.getCommandStack().execute(compoundCommand);
        context.select(command.newWidget);

    },
    
    updateStore: function() {
    	// widget specific data here, this example is EdgeToEdgeDataList
		var textArea = registry.byId("davinciIleb"),
    		value = textArea.attr('value'),
    		nodes = value,
    		rows = value.split('\n'),
			data = { identifier: 'label', items:[]},
			items = data.items;
		for (var r = 0; r < rows.length; r++){ 
			var cols = rows[r].split(',');
			var item = {};
			item.label = cols[0];
			if (cols[1]){
				item.moveTo = cols[1];
			} else {
				item.moveTo = 'dummy';
			}

			items.push(item);
		}
	
		
		return this.replaceStoreData(data);
	},

	replaceStoreData: function(data) {

		var store = this._widget.dijitWidget.store;

		var storeId = this._widget.domNode._dvWidget._srcElement.getAttribute("store");
		var storeWidget = Widget.byId(storeId);
		var properties = {};
		properties.data = data;
		storeWidget._srcElement.setAttribute('url', ''); 
		properties.url = ''; // this is needed to prevent ModifyCommmand mixin from puttting it back//delete properties.url; 
		var command = new ModifyCommand(storeWidget, properties);
		store.data = data;

		return command;
	},
		

	updateWidgetForUrlStore: function(){
		
		var textArea = registry.byId("davinciIleb");
    	this._url = textArea.value;
    	var url;
    	var patt=/http:\/\//i;
    	if (patt.test(this._url)){ // absolute url
    		url = this._url;
    	} else {
    		var parentFolder = new Path(this._widget._edit_context._srcDocument.fileName).getParentPath().toString();
			var file = resource.findResource(this._url, null, parentFolder); // relative so we have to get the absolute for the update of the store
            if (!file){
                alert('File: ' + this._url + ' does not exsist.');
                return;
            }
            url = file.getURL();
    	}
		var store = new ItemFileReadStore({url: url});
    	store.fetch({
    		query: this.query,
    		queryOptions:{deep:true}, 
			onComplete: lang.hitch(this, this._urlDataStoreLoaded),
    		onError: function(e){ alert('File ' + e  );}
    	});
    	this._urlDataStore = store;
    	
    
    	
	},
	
	_urlDataStoreLoaded : function(items){

		if (items.length < 1){
			console.error('Data store empty');
			return;
		}
		var storeId = this._widget.domNode._dvWidget._srcElement.getAttribute("store");
		var storeWidget = Widget.byId(storeId);
		var properties = {};
		var context = this._getContext();
        var widget = this._widget;
		properties.url = this._url; 
		storeWidget._srcElement.setAttribute('data', ''); 
		properties.data = ''; // to prevent ModifyCommand mixin from putting it back
		var storeCmd = new ModifyCommand(storeWidget, properties);
        var command = new ModifyCommand(widget, null, null, context);
        var compoundCommand = new OrderedCompoundCommand();
        compoundCommand.add(storeCmd);
        compoundCommand.add(command);
        context.getCommandStack().execute(compoundCommand); 
        context.select(command.newWidget);

	},
	
	show: function(widgetId) {
		
        this._widget = Widget.byId(widgetId);
	    
	    var width = 200;
		var height = 155;
		this._loading(height, width);
	    
		style.set('ieb', 'background-color', '#F7FDFF');
        var content = this._getTemplate();
        this._inline.attr("content", content);
		this._inline.eb = registry.byId("davinciIleb");
        this._inline.callBackObj = this;
 
		this._connection.push(connect.connect(this._inline, "onBlur", this, "onOk")); 
		this._connection.push(connect.connect(this._inline.eb, "onKeyUp", this, "handleEvent"));
		var folder = dom.byId('davinci.ve.input.DataGridInput_img_folder');
		this._connection.push(connect.connect(folder, "onclick", this, "fileSelection"));
		this._connectHelpDiv();
		this._connectResizeHandle();
		this._connectSimDiv();
		this._loadingDiv.style.backgroundImage = 'none'; // turn off spinner
		var dataStoreType = registry.byId("davinci.ve.input.DataGridInput.dataStoreType");
		this._connection.push(connect.connect(dataStoreType, "onChange", this, "changeDataStoreType"));
        var storeId = this._widget._srcElement.getAttribute("store"); 
   		var storeWidget = Widget.byId(storeId);
        this._data = storeWidget._srcElement.getAttribute('data'); 
        this._url = storeWidget._srcElement.getAttribute('url'); 
		this._inline.eb = registry.byId("davinciIleb");
		this._connection.push(connect.connect(this._inline.eb, "onMouseDown", this, "stopEvent"));
        if(this._data){ 
        	dataStoreType.setValue('dummyData');
        	this._dataStoreType = 'dummyData';
        	this._url = ' ';
        	this.refreshStoreView();
        }else{
        	dataStoreType.setValue('file');
        	this._dataStoreType = 'file';
        	this._inline.eb.setValue( this._url); 
        	this._data = ' ';
        }
        this.changeDataStoreType(this._dataStoreType);
		style.set('iedResizeDiv', 'background-color', 'white');
        var html = this._widget.getPropertyValue('escapeHTMLInData');
		var htmlRadio = registry.byId('davinci.ve.input.SmartInput_radio_html');
		var textRadio = registry.byId('davinci.ve.input.SmartInput_radio_text');
        if(html){
        	htmlRadio.set("checked", false);
			textRadio.set("checked", true);
        }else{
        	htmlRadio.set("checked", true);
			textRadio.set("checked", false);
        }
        this.updateFormats();

	},
	
	handleEvent: function(event){

		if (event.keyCode == 13) {
			var multiLine = this.multiLine;
			if (!multiLine || multiLine == "false" || this._lastKeyCode == 13){ // back to back CR
				this.onOk();
			}
		} else {
			this.updateFormats();
		}
		this._lastKeyCode = event.keyCode;
		this.updateSimStyle();
	},
	
	fileSelection: function(e){
		this._fileSelectionDialog = new Dialog({
			title : dojoxNls.selectSource,
			style : "width:275px;height:220px;padding:0px;background-color:white;"
		});

		//Set-up file selection tree
		var treeParms= {  
			id: "dataGridInputFileSelectionTree",
			style: "height:10em;margin-top:10px;overflow:auto",
			model: system.resource,
			filters: "new system.resource.FileTypeFilter(parms.fileTypes || '*');" //See #1725
	    };
		var tree = new Tree(treeParms);

		this._fileSelectionDialog.containerNode.appendChild(tree.domNode);
		
		//Set-up button
		var okClicked = function() {
			var tree = dijit.byId("dataGridInputFileSelectionTree");
			if (tree.selectedItem) {
				var selectedItemPathStr = tree.selectedItem.getPath();
				var path = new Path(selectedItemPathStr),
				srcDocPath = new Path(this._widget._edit_context._srcDocument.fileName),
				// ignore the filename to get the correct path to the image
				value = path.relativeTo(srcDocPath, true).toString(),
				textArea = dijit.byId("davinciIleb");
		    	textArea.setValue(value); 
		    	textArea.focus();
		    	this._url = tree.selectedItem;
		    	this._fileSelectionDialog.destroyRecursive();
		    	delete this._fileSelectionDialog;
		    	this.updateFormats();
			}
		};
		var dijitLangObj = commonNls;
		var okLabel = dijitLangObj.buttonOk;
		var okStyle = 'padding:8px;';
		var okBtn = new Button({
			label : okLabel,
			style : okStyle, /* type:"submit", */
			onClick : dojo.hitch(this, okClicked)
		});
		this._fileSelectionDialog.containerNode.appendChild(okBtn.domNode);
		
		//Set up cancel handler
		var onCancelFileSelection = function(e) {
			this._fileSelectionDialog.destroyRecursive();
			delete this._fileSelectionDialog;
		};
		this._connection.push(dojo.connect(this._fileSelectionDialog, "onCancel", this,
			onCancelFileSelection));
		
		//Show dialog
		this._fileSelectionDialog.show();
	},
	
	updateFormats: function(){
			
		// NOTE: if you put a break point in here while debugging it will break the dojoEllipsis
		if (this._dataStoreType === 'file' ){
			var textObj = dom.byId("davinci.ve.input.SmartInput_radio_text_width_div");
			var htmlObj = dom.byId("davinci.ve.input.SmartInput_radio_html_width_div");
			var htmlRadio = registry.byId('davinci.ve.input.SmartInput_radio_html');
			var textRadio = registry.byId('davinci.ve.input.SmartInput_radio_text');
			var table = dom.byId('davinci.ve.input.SmartInput_table');
			
			textObj.innerHTML = '<div class="dojoxEllipsis">Plain text  </div>';
			htmlObj.innerHTML = '<div id="davinci.ve.input.SmartInput_radio_html_div" class="dojoxEllipsis">HTML markup</div>';
			htmlRadio.setDisabled(false);
			textRadio.setDisabled(false);
			domClass.remove(textObj,'inlineEditDisabled');
			domClass.remove(htmlObj,'inlineEditDisabled');
			style.set(textRadio.domNode, 'display', '');
			style.set(htmlRadio.domNode, 'display', '');
			style.set(htmlObj, 'display', '');
			style.set(textObj, 'display', '');
			if (this.isHtmlSupported()) {
				style.set(table, 'display', '');
			} else {
				style.set(table, 'display', 'none');
			}
			
		} else {
			this.inherited(arguments);
			style.set('davinci.ve.input.DataGridInput_img_folder', 'display', 'none');
		}
	},
	
	changeDataStoreType: function (e){

		this._dataStoreType = e;
		var textArea = registry.byId("davinciIleb");
		var tagetObj = dom.byId("iedResizeDiv");
		var resizeWidth = style.get('iedResizeDiv', 'width');
		if (e === 'dummyData'){
			textArea.setValue( this._data);
	    	tagetObj.style.height = '85px';
			style.set('davinci.ve.input.DataGridInput_img_folder', 'display', 'none');
			style.set('ieb', 'width', resizeWidth + 15 + 'px' );
			
		}else if ( e=== 'file'){
			style.set('davinci.ve.input.DataGridInput_img_folder', 'display', '');
			textArea.setValue( this._url);
	    	tagetObj.style.height = '40px';
			
		}else if (e === 'url'){
			style.set('davinci.ve.input.DataGridInput_img_folder', 'display', 'none');
			textArea.setValue( this._url);
	    	tagetObj.style.height = '40px';
			style.set('ieb', 'width', resizeWidth + 15 + 'px' );
			
		} else {
			// we should not ever get here.
			console.error('DataGridInput:changeDataStoreType error');
		}
		this.updateFormats();
    	this.resize(null);
	},
	
	resize: function(e){
		
		this.inherited(arguments);	
		var tagetObj = dom.byId("iedResizeDiv");
		var targetEditBoxDijit = registry.byId("davinciIleb");
		var boxWidth = tagetObj.clientWidth  - 5;
		var boxheight = tagetObj.clientHeight -6;
		boxWidth = tagetObj.clientWidth  /*+2*/ -8;
		boxheight = tagetObj.clientHeight  -20; // new for text area
		style.set("davinci.ve.input.DataGridInput.dataStoreType", 'width',tagetObj.clientWidth + 15 + "px");
		
	
		if (targetEditBoxDijit) {
			targetEditBoxDijit._setStyleAttr({width: boxWidth + "px", height: boxheight + "px", maxHeight: boxheight + "px"}); // needed for multi line
		}
		targetEditBoxDijit._setStyleAttr({width: tagetObj.clientWidth - 20 + "px"});
				
			style.set('ieb', 'width', tagetObj.clientWidth + 30 + "px");
		if (this._dataStoreType === 'file') {
			style.set('davinci.ve.input.DataGridInput_img_folder', 'display', '');
			style.set('davinci.ve.input.DataGridInput_img_folder', 'left', tagetObj.clientWidth + 1  + 'px');
			style.set("davinci.ve.input.DataGridInput.dataStoreType", 'width',tagetObj.clientWidth + 15 + "px");
		} else {
			style.set("davinci.ve.input.DataGridInput.dataStoreType", 'width',tagetObj.clientWidth + "px");
		}
	},
	
	_getTemplate: function(){
		// XXX TODO THis should be moved to an HTML file.
		var template = ''+
		'<div id="davinciDataGridSmartInputFolderDiv" class="smartInputDataGridFolderDiv" style="background-color: #F7FCFF;	margin: 0 0 0 -1px;"> ' +
		'<table id="davinci.ve.input.DataGridInput_table" > ' +
			'<tbody>' + 
				'<tr>' +
					'<td></td>' + 
					'<td>' +
						'<select id="davinci.ve.input.DataGridInput.dataStoreType" name="davinci.ve.input.DataGridInput.dataStoreType" dojoType="dojox.form.DropDownSelect" style="width:15em;"> ' +
							'<option value="dummyData">Comma separated data</option> ' +
							'<option value="file">Data file from workspace</option> ' +
// hide for M2							'<option value="url">URL (JSONP)</option> ' +
						'</select>' +
					'<td>' +
					'<td></td>' + 
				'</tr>' +	
	
			'</tbody>'+ 
		'</table> '+
		'</div>' +
		'<div id="iedResizeDiv"  class="iedResizeDiv" style="width: 240px; height: 60px; border: 1px solid #769DC0; margin: 0 5px 0 5px;" >' + 
        '	<textarea  dojoType="dijit.form.SimpleTextarea" name="davinciIleb"  trim="true" id="davinciIleb" style="width:240px; height:60px;" class="smartInputTextArea" ></textarea>' +
			'<div id="smartInputSim" class="smartInputSim" style="display:none;" ></div>'+
			'<span id="davinci.ve.input.DataGridInput_img_folder"  title="Folder" class="inlineEditFolder" > </span>'+
			'<div id="iedResizeHandle" dojoType="dojox.layout.ResizeHandle" targetId="iedResizeDiv" constrainMin="true" maxWidth="200" maxHeight="600" minWidth="240" minHeight="40"  activeResize="true" intermediateChanges="true" ></div>' +
		'</div>'+
		'<div  id="davinci.ve.input.SmartInput_div"  class="davinciVeInputSmartInputDiv" >' + 
			'<div id="davinci.ve.input.SmartInput_radio_div" class="smartInputRadioDiv" >' + 
				'<table id="davinci.ve.input.SmartInput_table"> ' +
					'<tbody>' + 
						'<tr> ' +
							'<td class="smartInputTd1" > ' +
								'<input id="davinci.ve.input.SmartInput_radio_text" showlabel="true" type="radio" dojoType="dijit.form.RadioButton" disabled="false" readOnly="false" intermediateChanges="false" checked="true"> </input> '+
	             			'</td> ' +
	             			'<td class="smartInputTd2" >'+ 
	             				'<div id="davinci.ve.input.SmartInput_radio_text_width_div" class="smartInputRadioTextDiv">'+
	             				'</div>'+
             				'</td> ' +
         				'</tr>'+
         				'<tr> '+
         					'<td class="smartInputTd1"> <input id="davinci.ve.input.SmartInput_radio_html" showlabel="true" type="radio" dojoType="dijit.form.RadioButton"> </input>  </td> '+
         					'<td class="smartInputTd2">'+
         						'<div id="davinci.ve.input.SmartInput_radio_html_width_div" class="smartInputRadioTextDiv">'+
         						'</div>'+
             				'</td> '+
     					'</tr> '+
 					'</tbody>'+ 
					'</table> '+
				'<div class="smartInputHelpDiv" > '+
	        		'<span id="davinci.ve.input.SmartInput_img_help"  title="Help" class="inlineEditHelp" > </span>'+
		        	'<span class="smartInputSpacerSpan" >'+
		        	'<button id="davinci.ve.input.SmartInput_ok"  dojoType="dijit.form.Button" type="button" class="inlineEditHelpOk" >OK</button> <button id=davinci.ve.input.SmartInput_cancel dojoType="dijit.form.Button" class="inlineEditHelpCancel"> Cancel</button>  '+
		        	'</span>   '+
		        '</div> '+
		        '<div id="davinci.ve.input.SmartInput_div_help" style="display:none;" class="smartInputHelpTextDiv" > '+
		        	'<div dojoType="dijit.layout.ContentPane" style="text-align: left; padding:0; " >'+this.getHelpText()+ '</div> '+
		        	'<div style="text-align: left; padding:0; height:2px;" ></div> '+
		        '</div> '+
	        '</div>' + 
        '</div> '+
        '';
			return template;
	}

});

});