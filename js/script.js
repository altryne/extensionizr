$(function(){

	/************
	    CONFIG
	 ************/
	var config = {

		defaultModules:{
			blank: [
				'hidden-mode',
				'with-bg',
				'with-persistent-bg',
				'no-options',
				'no-override'],
			page_action:[
				'page-mode',
				'with-bg',
				'with-persistent-bg',
				'no-override',
				'no-options'
			],
			browser_action:[
				'browser-mode',
				'with-bg',
				'with-persistent-bg',
				'no-override',
				'no-options'
			]
		}
	};

	/************
	   VARIABLES
	 ************/

	var params;
	var modules = [];
	var dirs_to_remove = [];
	var files_to_remove = [];
	var manifest;

	/**********
	   EVENTS
	 **********/

	$('input').click(function(){
		update();
		debugger;
		_gaq.push(['_trackEvent', 'Settings', $(this).val() ]);
	});
	$('#match_ptrns').blur(function(){
		update();
	});


	$('#preconfig-blank').click(function(){
		fillDefaultModules('blank');
		_gaq.push(['_trackEvent', 'Buttons', "preconfig-blank"]);
	});

	$('#preconfig-page').click(function(){
		fillDefaultModules('page_action');
		_gaq.push(['_trackEvent', 'Buttons', "preconfig-page"]);
	});

	$('#preconfig-browser').click(function(){
		fillDefaultModules('browser_action');
		_gaq.push(['_trackEvent', 'Buttons', "preconfig-browser"]);
	});

	/*********
	   LOGIC
	 *********/
	function init(){
		if(window.location.hash == ""){
			fillDefaultModules('blank');
		}else{
			url_params = JSON.parse(window.location.hash.substr(1));
			url_bool_params = url_params['modules'].concat(url_params['boolean_perms']);
			for (var i = 0, curModule; curModule = url_bool_params[i++];){
				$('input[value="' + curModule +'"]').attr('checked', true);
			};
			$('#match_ptrns').val(""+url_params['match_ptrns'].join(';'));
		}
	}
	function fillDefaultModules(type){
		$('input').attr('checked', false);
		for (var i = 0, curModule; curModule = config.defaultModules[type][i++];){
			$('input[value=' + curModule +']').attr('checked', true);
		};
		update();
		$('#hidden-section').fadeIn('slow');
	}

	function update(){
		updateModules();
	}

	function updateModules(){
		modules = [];
		permissions = [];
		boolean_perms = [];
		match_ptrns = [];
		$('input').each(function(){
			if($(this).is('.perm') && $(this).is(':checked')){
				boolean_perms.push($(this).val());
			}else if ($(this).is(':checked')){
				modules.push($(this).val());
			}else if($(this).is('.match_pattern') && $(this).val() !=''){
				match_ptrns = $(this).val().split(';');
			}
		});
		permissions = boolean_perms.concat(match_ptrns);
//		/* pushstate */
		var url = JSON.stringify({
						"modules" : modules,
						"boolean_perms" : boolean_perms,
						"match_ptrns" : match_ptrns
						});
		history.replaceState(null, 'Extensionizr', '!#'+url);
		//check if user already changed the zip file, if so, regenerate
		if(!downloadButton.download){
			updateManifestFile();
		}else{
			downloadButton.removeAttribute('download');
			genButton.html('Download it!');
			importZip(function(){
				updateManifestFile();
			});
		}
	}


	function updateManifestFile(){
		manifest = $.extend(true,{},window.manifest);
		dirs_to_remove = [];
		files_to_remove = [];

		if(!manifest.name) return;
		//define a list of "reverse" modules, if they aren't present,add no-module to modules list
		var reverse_modules = ["with-persistent-bg","inject-css","inject-js","jquerymin","angular","omnibox"];

		$.each(reverse_modules,function(i,item){
			if(!modules.has(item)) modules.push('no-' + item);
		});


		/*
		*  Background page/script/event page
		*/

		if(modules.has('hidden-mode')){
			delete manifest.page_action;
			delete manifest.browser_action;
			dirs_to_remove.push("src/page_action");
			dirs_to_remove.push("src/browser_action");
		}else if(modules.has('page-mode')){
			delete manifest.browser_action;
			dirs_to_remove.push("src/browser_action");
		}else if(modules.has("browser-mode")){
			delete manifest.page_action;
			dirs_to_remove.push("src/page_action");
		}
		/*
		*  Background page/script/event page
		*/

		if ( modules.has('no-bg') ) {
			delete manifest.background;
			dirs_to_remove.push("src/bg");
		} else{
			manifest.background.persistent = modules.has('with-persistent-bg');
			if ( modules.has('with-js-bg') ){
				delete manifest.background.page;
				files_to_remove.push("src/bg/background.html");
			} else if (modules.has('with-bg')){
				delete manifest.background.scripts;
			}
		}
		/*
		*  overrides
		*/

		if ( modules.has('no-override') ) {
			delete manifest.chrome_url_overrides;
			dirs_to_remove.push("src/override");
		} else{
			var url = manifest.chrome_url_overrides.newtab;
			if ( modules.has('override-bookmarks') ){
				delete manifest.chrome_url_overrides.newtab;
				manifest.chrome_url_overrides.bookmarks = url;
				if(!permissions.has('bookmarks')){
					$('.perm[value="bookmarks"]').prop('checked',true);
					permissions.push('bookmarks');
				}

			} else if (modules.has('override-history')){
				delete manifest.chrome_url_overrides.newtab;
				manifest.chrome_url_overrides.history = url;
				if(!permissions.has('history')){
					$('.perm[value="history"]').prop('checked',true);
					permissions.push('history');
				}
			 }
		}

		/*
		*  Options
		*/
		if ( modules.has('no-options') ) {
			delete manifest.options_page;
			delete manifest.options_custom_page;
			dirs_to_remove.push("src/options");
			dirs_to_remove.push("src/options_custom");
		}else{
			if(modules.has('with-options')){
				delete manifest.options_custom_page;
				dirs_to_remove.push("src/options_custom");
			}else if(modules.has('with-custom-options')){
				manifest.options_page = manifest.options_custom_page;
				delete manifest.options_custom_page;
				dirs_to_remove.push("src/options");
			}
		}

		/*
		*  Injects
		*/
		if ( !modules.has('inject-css') && !modules.has('inject-js') ) {
			delete manifest.content_scripts;
			dirs_to_remove.push("src/inject");
		}else{
			if(!modules.has('inject-css')){
				manifest.content_scripts.splice(0,1);
				files_to_remove.push("src/inject/inject.css");
			}
			if(!modules.has('inject-js')){
				manifest.content_scripts.splice(1,1);
				files_to_remove.push("src/inject/inject.js");
			}
		}
		/*
		* Addons
		 */

		if(!modules.has('jquerymin')){
			files_to_remove.push('js/jquery-1.8.3.min.js');
		}
		if(!modules.has('angular')){
			files_to_remove.push('js/angular.min.js');
		}
		if(!modules.has('omnibox')){
			delete manifest.omnibox;
		}
		/*
		*  Permissions
		*/
		if(permissions.length > 0){
			manifest.permissions = permissions;
		}else{
			delete manifest.permissions;
		}
	}


	/***********
	   HELPERS
	 ***********/

	if (!Array.indexOf){
		Array.prototype.indexOf = function(searchedElement){
			for (var i = 0; i < this.length; i++){
				if (this[i] === searchedElement)
					return i;
			};
			return -1;
		};
	}
	if(!Array.has){
		Array.prototype.has = function(searchedElement){
			var i = this.indexOf(searchedElement);
			return (i > -1) ? true : false;
		}
	}

	Array.prototype.remove = function(searchedElement){
		var i = this.indexOf(searchedElement);
		if (i != -1)
			this.splice(i, 1);
	};

	/***********
	    MAIN
	 ***********/
	var filesystem, zipFs = new zip.fs.FS();
	var genButton = $('#gen-link');
	var downloadButton = $('#download-link')[0];

//	if ($('input:checked').length > 0)
//		$('#hidden-section').fadeIn(0);
	init();

	var elms = $('.more_info');
	$('<div/>').qtip({
		content : {text:"a"},
		style: {
			classes: 'qtip-shadow qtip-blue'
		},
		position : {
			target : 'event',
			at : "top center",
			my : "bottom center",
			viewport: $('#main'),
			adjust: {
						y: -5,
						method : 'flip none'
					}
		},
		show : {
			target : elms
		},
		hide : {
			target : elms
		},
		events: {
			show: function(event, api) {
				var target = $(event.originalEvent.target);
				api.set('content.text', target.data('content').replace('. ','<br>'));
			}
		}
	});

	genButton.on('click',function(){
		processZip();
		event.preventDefault();
		return false;
	});

	function onerror(message) {
		console.error(message);
	}

	zip.workerScriptsPath = "zip/";
	imported_zip_root = "ext/";

	function importZip(callback){
		zipFs.importHttpContent("ext.zip", false, function() {
				extFs =  zipFs.root.children[0];
				manifestFs =  extFs.getChildByName('manifest.json');
				manifestFs.getText(function(data){
					window.manifest = JSON.parse(data);
					if(typeof callback == 'function'){
						callback();
					}
				});
			}, onerror);
	};
	importZip();
	function processZip(_data){
		if (!downloadButton.download) {
			console.log('generating the zip file eyooooooo');
			manifest = _data || manifest;
			manifestJson = JSON.stringify(manifest,null,2);
			for (var i = 0; i < dirs_to_remove.length; i++) {
				var dir = dirs_to_remove[i];
				var dirFs = zipFs.find(imported_zip_root + dir);
				console.log('removing directory: ' + dir);
				zipFs.remove(dirFs);
			}
			for (var i = 0; i < files_to_remove.length; i++) {
				var file = files_to_remove[i];
				var fileFs = zipFs.find(imported_zip_root + file);
				console.log('removing file: ' + file);
				zipFs.remove(fileFs);
			}

			//remove old cluncky manifest file from zip
			zipFs.remove(manifestFs);
			//write new manifest to filesystem API
			extFs.addText('manifest.json', manifestJson);
			genButton.html('Generating download!').addClass('loading');
			zipFs.exportData64URI(function (data) {
				genButton.html('Download ready!').removeClass('loading');

				var clickEvent = document.createEvent("MouseEvent");
				clickEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
				downloadButton.href = data;
				_gaq.push(['_trackEvent', 'Buttons', "download-button"]);
				downloadButton.download = 'extensionizr_custom' + Date.now() + '.zip';
				downloadButton.dispatchEvent(clickEvent);
				event.preventDefault();
				return false;

			}, $.noop, function(){
				genButton.html('Something went wrong').removeClass('loading');
			});
		}else{
			//redownload
			var clickEvent = document.createEvent("MouseEvent");
			clickEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
			downloadButton.dispatchEvent(clickEvent);
			event.preventDefault();
			return false;
		}
	}

});
