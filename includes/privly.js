// ==UserScript==
// @include http://*/*
// @include https://*/*
// ==/UserScript==
// Opera recommends UserJS Headers
/*******************************************************************************
Open Source Initiative OSI - The MIT License (MIT):Licensing
[OSI Approved License]
The MIT License (MIT)

Copyright (c) Sean McGregor

Permission is hereby granted, free of charge, to any person obtaining a copy 
of this software and associated documentation files (the "Software"), to deal 
in the Software without restriction, including without limitation the rights 
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell 
copies of the Software, and to permit persons to whom the Software is 
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in 
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, 
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, 
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, 
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
DEALINGS IN THE SOFTWARE.

*******************************************************************************/
var privly = {

  //Matches:
  //              http://
  //              https://
  //                        priv.ly/textAndNumbers/any/number/of/times
  //                                                                          
  //also matches localhost:3000
  privlyReferencesRegex: /\b(https?:\/\/){0,1}(priv\.ly|localhost:3000)(\/posts)(\/\w*){1,}\b/gi,
  
  /*
   * enum to hold various extension modes and their value. extension modes are set through firefox's
   * extension api. https://developer.mozilla.org/en/Code_snippets/Preferences
   */ 
  extensionModeEnum : {
    ACTIVE : 0,
    PASSIVE : 1,
    CLICKTHROUGH : 2
  },
  
  // Takes a domain with an optional http(s) in front and returns a fully formed domain name
  makeHref: function(domain)
  {
    var hasHTTPRegex = /^((https?)\:\/\/)/i
    if(!hasHTTPRegex.test(domain)) 
        domain = "http://" + domain;
    return domain;
  },

  //Make plain text links into anchor elements
  createLinks: function() 
  {
      /*************************************************************************
      Inspired by Linkify script:
        http://downloads.mozdev.org/greasemonkey/linkify.user.js

      Originally written by Anthony Lieuallen of http://arantius.com/
      Licensed for unlimited modification and redistribution as long as
      this notice is kept intact.
      **************************************************************************/

      var excludeParents = ["a", "applet", "button", "code", "form",
                             "input", "option", "script", "select", "meta", 
                             "style", "textarea", "title", "div","span"];
      var excludedParentsString = excludeParents.join(" or parent::");
      var xpathExpression = ".//text()[not(parent:: " + excludedParentsString +")]";

      //Expanded XPathResult so that Opera can recognize it
	  textNodes = document.evaluate(xpathExpression, document.body, null, 
                                    window.XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);

      for(var i=0; i < textNodes.snapshotLength; i++){
          item = textNodes.snapshotItem(i);

          var itemText = item.nodeValue;
          
          privly.privlyReferencesRegex.lastIndex = 0;
          if(privly.privlyReferencesRegex.test(itemText)){
              var span = document.createElement("span");    
              var lastLastIndex = 0;
              privly.privlyReferencesRegex.lastIndex = 0;
              for(var results = null; results = privly.privlyReferencesRegex.exec(itemText); ){
                  var href = results[0];
                  span.appendChild(document.createTextNode(itemText.substring(lastLastIndex, results.index)));

                  var text = (href.indexOf(" ")==0)?href.substring(1):href;

                  var href = privly.makeHref(text);

                  var a = document.createElement("a");
                  a.setAttribute("href", href);
                  a.appendChild(document.createTextNode(text.substring(0,4).toLowerCase()+text.substring(4)));
                  if(href.indexOf(" ")==0) 
                      span.appendChild(document.createTextNode(" "));
                  span.appendChild(a);
                  lastLastIndex = privly.privlyReferencesRegex.lastIndex;
              }
              span.appendChild(document.createTextNode(itemText.substring(lastLastIndex)));
              item.parentNode.replaceChild(span, item);
          }
      }
  },

  //Kill default link behaviour on Privly Links
  makePassive: function(anchor) 
  {    
    //Preventing the default link behavior
    anchor.addEventListener("mousedown", function(e){
        e.cancelBubble = true;
        e.stopPropagation();
        e.preventDefault();
        privly.replaceLink(anchor);		
      });
  },
  
  //Checks link attributes and text for privly links without the proper href attribute.
  //Twitter and other hosts change links so they can collect click events.
  correctIndirection: function() 
  {
    var anchors = document.links;	
    var i = anchors.length;
    while (i--){
      var a = anchors[i];
      
      if(a.href && (a.href.indexOf("priv.ly/posts/") == -1 || a.href.indexOf("priv.ly/posts/") > 9))
      {
        //check if Privly is in the body of the text
        privly.privlyReferencesRegex.lastIndex = 0;
        if (privly.privlyReferencesRegex.test(a.innerHTML)) {        
          // If the href is not present or is on a different domain
          privly.privlyReferencesRegex.lastIndex = 0;
          var results = privly.privlyReferencesRegex.exec(a.innerHTML);
          var newHref = privly.makeHref(results[0]);
          a.setAttribute("href", newHref);
        }
        
        //check if Privly was moved to another attribute
        for (var y = 0; y < a.attributes.length; y++) {
          var attrib = a.attributes[y];
          if (attrib.specified == true) {
            privly.privlyReferencesRegex.lastIndex = 0;
            if (privly.privlyReferencesRegex.test(attrib.value)) {
              a.setAttribute("href", attrib.value);
            }
          }
        }
      }
      privly.privlyReferencesRegex.lastIndex = 0;
    }
  },

  nextAvailableFrameID: 0,

  // Replace an anchor element with its referenced content.
  replaceLink: function(object) 
  {
	if(object)
	{
	
    var iFrame = document.createElement('iframe');
    iFrame.setAttribute("frameborder","0");
    iFrame.setAttribute("vspace","0");
    iFrame.setAttribute("hspace","0");
    iFrame.setAttribute("name","privlyiframe");
    iFrame.setAttribute("width","100%");
    iFrame.setAttribute("marginwidth","0");
    iFrame.setAttribute("marginheight","0");
    iFrame.setAttribute("height","1px");
    iFrame.setAttribute("src",object.href + ".iframe?frame_id=" + privly.nextAvailableFrameID);
    iFrame.setAttribute("id","ifrm"+privly.nextAvailableFrameID);
    iFrame.setAttribute("frameborder","0");
    privly.nextAvailableFrameID++;
    iFrame.setAttribute("style","width: 100%; height: 32px; overflow: hidden;");
    iFrame.setAttribute("scrolling","no");
    iFrame.setAttribute("overflow","hidden");
	if(object.parentNode) {
		opera.postError("obj = " + object + " pn = " + object.parentNode);
		object.parentNode.replaceChild(iFrame, object);
	}
	}
  },
  
  //Replace all Privly links with their iframe
  replaceLinks: function(){
        elements = document.getElementsByTagName("privModeElement");
    if(elements != null && elements.length != 0){
      this.extensionMode = elements[0].getAttribute('mode');
    }
    var anchors = document.links;
    var i = anchors.length;

    while (--i >= 0){
      var a = anchors[i];
      this.privlyReferencesRegex.lastIndex = 0;
      if(a.href && this.privlyReferencesRegex.test(a.href))
      {
      	var exclude = a.getAttribute("privly");
        if(exclude == null || exclude != "exclude"){
          if(this.extensionMode == privly.extensionModeEnum.ACTIVE){
            this.replaceLink(a);
          }
          else if(this.extensionMode == privly.extensionModeEnum.PASSIVE){
            a.innerHTML = 'Read in Place';
			opera.postError("a = " + a);
            //a.addEventListener("mousedown",privly.makePassive,true);
			privly.makePassive(a);
          }
          else if(this.extensionMode == privly.extensionModeEnum.CLICKTHROUGH){
            a.innerHTML = "Privly is in sleep mode so it can catch up with demand. The content may still be viewable by clicking this link";
            a.setAttribute('target','_blank');
            a.removeEventListener("mousedown",privly.makePassive,true);
          }
        }
      }
    }
  },

  //resize the iframe using a posted message
  resizeIframe: function(message){
    
	// prevents MessageType objects from being handled in this function.
	// Causes JavaScript errors in Opera as message.data.split() fails on an Object type.
	var type = typeof message.data;	
	if(type !== 'string') return;
	
    if(message.origin !== "https://priv.ly" && message.origin !== "http://localhost:3000")
      return;
    
    var data = message.data.split(",");
    
    var iframe = document.getElementById("ifrm"+data[0]);
    iframe.style.height = data[1]+'px';
  },
  //indicates whether the extension shoud immediatly replace all Privly
  //links it encounters
  extensionMode: widget.preferences.extensionMode,
  //prevents DOMNodeInserted from sending hundreds of extension runs
  runPending: false,
  
  //prep the page and replace the links if it is in active mode
  run: function(){

    //create and correct the links pointing
    //to Privly content
    privly.createLinks();
    privly.correctIndirection();
    
    //replace all available links on load, if in active mode,
    //otherwise replace all links default behavior
    privly.replaceLinks();
  },
  
  // Reference to background Process Window.
  // Used to avoid unnecessary Messaging Calls for inter-process communication.
  bgProcess: "",
  
  //runs privly once then registers the update listener
  //for dynamic pages
  listeners: function(){
    //don't recursively replace links
    if(document.URL.indexOf('priv.ly') != -1 || document.URL.indexOf('localhost:3000') != -1)
      return;
        
    //The content's iframe will post a message to the hosting document. This listener sets the height 
    //of the iframe according to the messaged height
    window.addEventListener("message", privly.resizeIframe, false, true);
    
    privly.runPending=true;
    setTimeout(
      function(){
        privly.runPending=false;
        privly.run();
      },
      100);
    
    //Everytime the page is updated via javascript, we have to check
    //for new Privly content. This might not be supported on other platforms
    document.addEventListener("DOMNodeInserted", function(event) {
      
      //we check the page a maximum of two times a second
      if(privly.runPending )
        return;
      privly.runPending=true;	  
      
      setTimeout(
        function(){
          privly.runPending=false;
          privly.run();
        },
        500);
		
		var inputTags = document.querySelectorAll("input[type='text']"); 
		for (i=0; i < inputTags.length; i++)
		{	 
		
		
		inputTags[i].onchange=function(){			
			//opera.extension.bgProcess.content = window.event.target.value;
			//TODO: Remove inputLocation. REFER: background.js::postInfo
			privly.bgProcess.postMessage({message: window.event.target.value, type: "contentPost", inputTag: "input", inputLocation: i});
			//window.event.target.value = window.event.target.value.toUpperCase();
			//int=self.setInterval("alertit()",3000);
		}
		}
		
		for (i=0; i < document.getElementsByTagName("textarea").length; i++)
		{	 
		
		
		document.getElementsByTagName("textarea")[i].onchange=function(){
			//opera.postError("wtf");
			//opera.extension.bgProcess.content = window.event.target.value;
			privly.bgProcess.postMessage({message: window.event.target.value, type: "contentPost", inputTag: "textarea", inputLocation: i});
			//window.event.target.value = window.event.target.value.toUpperCase();
			//int=self.setInterval("alertit()",3000);
		}
		
				
}
    });
	//Sanchit
	
	/*document.addEventListener("change", function(event) {
		
	
	});*/
	
	/*opera.extension.onmessage = function(event){
		var thecatch = event.data; // event.data in this case will contain the string "Hello there"
	};*/
	opera.extension.onmessage = function(event){
		// Get content of incoming message.
		opera.postError("inside onmsg");
		var d  = event.data;
		if(d.type == "privly:init")	{
			privly.bgProcess = event.source;
			//opera.postError("Background process sent");
		}
		if(d.type == "postContentSuccess") {
			if(d.post.postTag == "textarea")
			{
				//document.getElementsByTagName("textarea")[d.post.postLocation].value = d.message;
				//d.post.target.value = d.message;
				//TODO: Use document.querySelectorAll('textarea,input') instead
				for (i=0; i < document.getElementsByTagName("textarea").length; i++) {
					if(document.getElementsByTagName("textarea")[i].value == d.post.content) {
						document.getElementsByTagName("textarea")[i].onchange = null;												
						document.getElementsByTagName("textarea")[i].value = d.message;
					}
				}
				
				if(document.domain == "facebook.com") {
					var hiddenInputTags = document.querySelectorAll("input[type='hidden']"); 
					for (i=0; i < hiddenInputTags.length; i++) {
						if(hiddenInputTags[i].value == d.post.content)
						{
							hiddenInputTags[i].onchange = null;												
							hiddenInputTags[i].value = d.message;
						}
					}
				}
			}
			
			if(d.post.postTag == "input") {				
				var inputTags = document.querySelectorAll("input[type='text']"); 
				for (i=0; i < inputTags.length; i++)
				{
					if(inputTags[i].value == d.post.content)
					{
						inputTags[i].onchange = null;												
						inputTags[i].value = d.message;
					}
				}
			}
			
		}
		
		if(d.type == "postContentFailed") {
			opera.postError("postContentFailed");
		}
		
		if(d.type == "extensionModeChange")	{
			//opera.postError("premodechange: " + d.mode);
			privly.extensionMode = d.mode;
			//opera.postError("postmodechange: " + d.mode);
		}

		//  Replies back to background script.
		//var reply = "Background process's message only had " + (message ? message.length : 0) + " characters.";
		//privly.bgProcess.postMessage(reply); 
	};
  }
};

privly.listeners();
