// ==UserScript==
// @include http://*/*
// @include https://*/*
// @exclude https://priv.ly/*
// @exclude https://www.privly.org/*
// @exclude https://privly.org/*
// @exclude http://www.privly.org/*
// @exclude http://privly.org/*
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

/**
* @fileOverview For a high level overview of what this script does, see:
* http://www.privly.org/content/core-functionality-privlyjs
* @author Sean McGregor, Sanchit Karve
* @version 0.2-dev
**/

/**
* @namespace
* Script injected into the host page.
*
* HOST PAGE CONFIGURATION
*
* The host page can influence the behaviour of this script by including
* privly-exclude="true" as an attribute on either the body element,
* or an individual link element. If the body has the privly-exclude attribute:
*
* <body privly-exclude="true">
*
* Then the script will only respond to resize messages.
*
* If a link has the attribute, as in here:
*
* <a href="https://example.com" privly-exclude="true">
*
* Then it is not replaced with the referenced content.
*
*
****URL PARAMETERS***
*
* The script also responds to parameters 
* and anchors on the URL. 
*
* burntAfter: specifies a time in seconds in the Unix epoch
* until the content is likely destroyed on the remote server
* Destruction of the content should result in a change of message,
* but not a request to the remote server for the content
*
* burntMessage: Display this message if the content was burnt, as
* indicated by the burnAfter parameter.
*
* passiveMessage: Display this message when the extension is in
* passive mode.
*
* passive: Forces the link into passive mode
* exclude: Force the link to not be replaced or put into passive
* mode
*
**/
var privly = {  
  /**
   * These messages are displayed to users. These strings cannot be in this
   * script when we start localization.
   */
  messages: {
    sleepMode: "Privly is in sleep mode so it can catch up with " + 
      "demand. The content may still be viewable by clicking this link",
    passiveModeLink: "Read in Place",
    contentExpired: "The content behind this link likely expired. Click the link to check.",
    privlyContent: "Privly Content: ",
    burntPrivlyContent: "Burnt Privly Content: "
},

  /**
   * Gives a map of the URL parameters and the anchor. 
   * This method includes the anchor element under the binding 'anchor'
   *
   * @param {string} url The url you need a map of parameters from.
   *
   * @returns {array} A map of the URL parameters and the anchor.
   */
  getUrlVariables: function(url) {
    var vars = {};
    if(url.indexOf("#",0) > 0) {
      var anchor = url.substring(url.indexOf("#",0) + 1, url.length);
      vars["anchor"] = anchor;
      url = url.split("#",1)[0];
    }
    url = url.replace("&amp;", "&")
    var parts = url.replace(/[?&]+([^=&]+)=([^&]*)/gi, 
      function(m,key,value) {
        vars[key] = value;
      });
    return vars;
  },

  /** 
   * The Privly RegExp determines which links are eligible for
   * automatic injection.
   * This system will need to change so we can move to a whitelist 
   * approach. See: http://www.privly.org/content/why-privly-server
   *
   * Currently matched domains are priv.ly, dev.privly.org, dev.privly.com, 
   * privly.com, pivly.org, privly.com, and localhost
   *
   */
  privlyReferencesRegex: new RegExp("\\b(https?:\\/\\/){0,1}(" + 
    "priv\\.ly\\/posts\\/\\d+|" +
    "dev\\.privly\\.org\\/posts\\/\\d+|" +
    "privly\\.org\\/posts\\/\\d+|" +
    "privly\\.com\\/posts\\/\\d+|" +
    "dev\\.privly\\.com\\/posts\\/\\d+|" +
    "localhost:3000\\/posts\\/\\d+" + 
    ")(\\b|\\?(\\S)*|#(\\S)*)$","gi"),
    //the final line matches 
    //end of word OR
    //the parameter string to the end of the word OR
    //the anchor string to the end of the word


  /** 
   * Holds the identifiers for each of the modes of operation.   
   */
  extensionModeEnum : {
    ACTIVE: 0,
    PASSIVE: 1,
    CLICKTHROUGH: 2
  },

  /**
   * Sets a mode of operation found in extensionModeEnum.
   */
  extensionMode: widget.preferences.extensionMode,

  /** 
   * Adds 'http' to strings if it is not already present
   *
   * @param {string} domain the domain potentially needing a protocol.
   *
   * @returns {string} The corresponding URL
   */
  makeHref: function(domain) {
    var hasHTTPRegex = /^((https?)\:\/\/)/i;
    if(!hasHTTPRegex.test(domain))
    domain = "http://" + domain;
    return domain;
  },

  /**
   * Make plain text links into anchor elements.
   */
  createLinks: function() {
    /***********************************************************************
    Inspired by Linkify script:
    http://downloads.mozdev.org/greasemonkey/linkify.user.js
    
    Originally written by Anthony Lieuallen of http://arantius.com/
    Licensed for unlimited modification and redistribution as long as
    this notice is kept intact.
    ************************************************************************/

    var excludeParents = ["a", "applet", "button", "code", "form",
      "input", "option", "script", "select", "meta", 
      "style", "textarea", "title", "div","span"];
    var excludedParentsString = excludeParents.join(" or parent::");
    var xpathExpression = ".//text()[not(parent:: " + 
      excludedParentsString +")]";
    //Expanded XPathResult so that Opera can recognize it
    textNodes = document.evaluate(xpathExpression, document.body, null, 
      window.XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);

    for(var i=0; i < textNodes.snapshotLength; i++) {
      item = textNodes.snapshotItem(i);

      var itemText = item.nodeValue;

      privly.privlyReferencesRegex.lastIndex = 0;
      if(privly.privlyReferencesRegex.test(itemText)) {
        var span = document.createElement("span");    
        var lastLastIndex = 0;
        privly.privlyReferencesRegex.lastIndex = 0;

        for(var results = null; 
          results = privly.privlyReferencesRegex.exec(itemText); ) {
          var href = results[0];
          span.appendChild(document.createTextNode(
            itemText.substring(lastLastIndex, results.index)));

          var text = (href.indexOf(" ")==0)?href.substring(1):href;

          var href = privly.makeHref(text);

          var a = document.createElement("a");
          a.setAttribute("href", href);
          a.appendChild(document.createTextNode(
          text.substring(0,4).toLowerCase() + text.substring(4)));
          if(href.indexOf(" ") == 0) { 
            span.appendChild(document.createTextNode(" "));
          }
          span.appendChild(a);
          lastLastIndex = privly.privlyReferencesRegex.lastIndex;
        }
        span.appendChild(document.createTextNode(
          itemText.substring(lastLastIndex)));
        item.parentNode.replaceChild(span, item);
      }
    }
  },

  /**
   * Kill default link behaviour on Privly Link, which was clicked, and
   * replace the link with the referenced content.
   *
   * @param {event} e An event triggered by clicking a link, which needs
   * replacing
   */
  makePassive: function(e) {
    //Preventing the default link behavior    
    e.cancelBubble = true;
    e.stopPropagation();
    e.preventDefault();
    privly.replaceLink(e.target);	 
  },

  /**
   * Changes hyperlinks to reference the proper url.
   * Twitter and other hosts change links so they can collect
   * click events.
   */
  correctIndirection: function() {
    var anchors = document.links;	
    var i = anchors.length;
    while (i--) {
      var a = anchors[i];
      
      privly.privlyReferencesRegex.lastIndex = 0;
      if(a.href && !privly.privlyReferencesRegex.test(a.href)) {
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

  /**
   * Counter for injected frame identifiers.
   */
  nextAvailableFrameID: 0,

  /**
   * Replace an anchor element with its referenced content.
   *
   * @param {object} object A hyperlink element to be replaced
   * with an iframe referencing its content
   */
  replaceLink: function(object) {
    // Prevents javascript errors as replaceLink is called even when parentNode is null
    if(object.parentNode != null) {

      var iFrame = document.createElement('iframe');
      iFrame.setAttribute("frameborder","0");
      iFrame.setAttribute("vspace","0");
      iFrame.setAttribute("hspace","0");
      iFrame.setAttribute("name","privlyiframe");
      iFrame.setAttribute("width","100%");
      iFrame.setAttribute("marginwidth","0");
      iFrame.setAttribute("marginheight","0");
      iFrame.setAttribute("height","1px");

      if(object.href.indexOf("?") > 0) {
        var iframeUrl = object.href.replace("?",".iframe?frame_id="+
        privly.nextAvailableFrameID+"&");
        iFrame.setAttribute("src",iframeUrl);
      }
      else if(object.href.indexOf("#") > 0) {
        var iframeUrl = object.href.replace("#",".iframe?frame_id="+
        privly.nextAvailableFrameID+"#");
        iFrame.setAttribute("src",iframeUrl);
      }
      else {
        iFrame.setAttribute("src",object.href + ".iframe?frame_id=" + 
        privly.nextAvailableFrameID);
      }
      iFrame.setAttribute("id","ifrm"+privly.nextAvailableFrameID);
      iFrame.setAttribute("frameborder","0");
      privly.nextAvailableFrameID++;
      iFrame.setAttribute("style","width: 100%; height: 32px; overflow: hidden;");
      iFrame.setAttribute("scrolling","no");
      iFrame.setAttribute("overflow","hidden");
      //if(object.parentNode) {
      //opera.postError("obj = " + object + " pn = " + object.parentNode);
      object.parentNode.replaceChild(iFrame, object);
      //}
    }
  },

  /**
   * Replace all Privly links with their iframe or
   * a new link, which when clicked will be replaced
   * by the iframe
   */
  replaceLinks: function() {
    elements = document.getElementsByTagName("privModeElement");
    if(elements != null && elements.length != 0) {
      this.extensionMode = elements[0].getAttribute('mode');
    }
    var anchors = document.links;
    var i = anchors.length;

    while (--i >= 0) {
      var a = anchors[i];
      this.privlyReferencesRegex.lastIndex = 0;
      if(a.href && this.privlyReferencesRegex.test(a.href)) {
        var exclude = a.getAttribute("privly-exclude");
        var params = privly.getUrlVariables(a.href);
        if(!exclude && !params["exclude"]) {
          var burntAfter = params["burntAfter"];

          if(burntAfter != null && parseInt(burntAfter) < Date.now()) {
            if(params["burntMessage"] != null) {
              var burntMessage = params["burntMessage"].replace(/\+/g, " ");
              a.innerHTML = privly.messages.burntPrivlyContent + burntMessage;
            }
            else {
              this.replaceLink(a);
              //a.innerHTML = privly.messages.contentExpired;
            }
            a.setAttribute('target','_blank');
            a.removeEventListener("mousedown",privly.makePassive,true);
          }
          else if(this.extensionMode == privly.extensionModeEnum.PASSIVE ||
            params["passive"] != null) {
            if(params["passiveMessage"] != null) {
              var passiveMessage = params["passiveMessage"].replace(/\+/g, " ");
              a.innerHTML = privly.messages.privlyContent + passiveMessage;
            }
            else {
              a.innerHTML = privly.messages.privlyContent + 
              privly.messages.passiveModeLink;
            }
            a.addEventListener("mousedown",privly.makePassive,true);
          }			
          else if(this.extensionMode == privly.extensionModeEnum.ACTIVE) {
            this.replaceLink(a);
          }
          else if(this.extensionMode == privly.extensionModeEnum.CLICKTHROUGH) {
            a.innerHTML = privly.messages.sleepMode;
            a.setAttribute('target','_blank');
            a.removeEventListener("mousedown",privly.makePassive,true);
          }          
        }
      }
    }
  },

  /**
   * Receive an iframe resize message sent by the iframe using postMessage.
   * Injected iframe elements need to know the height of the iframe's contents.
   * This function receives a message containing the height of the iframe, and
   * resizes the iframe accordingly.
   *
   * @param {message} message A posted message from one of the trusted domains
   * it contains the name or id of the iframe, and height of the iframe's 
   * contents
   *
   */
  resizeIframe: function(message) {

    // prevents MessageType objects from being handled in this function.
    // Causes JavaScript errors in Opera as message.data.split() fails on an Object type.
    var type = typeof message.data;	
    if(type !== 'string') return;

    if(message.origin !== "https://priv.ly" && 
      message.origin !== "http://localhost:3000" &&
      message.origin !== "http://dev.privly.org" && 
      message.origin !== "http://dev.privly.com" && 
      message.origin !== "https://privly.org" && 
      message.origin !== "https://privly.com") {
      return;
    }

    var data = message.data.split(",");

    var iframe = document.getElementById("ifrm"+data[0]);
    iframe.style.height = data[1]+'px';
  },

  /** 
   * Indicates whether the script is waiting to run again.
   * This prevents DOMNodeInserted from sending hundreds of extension runs
   */
  runPending: false,

  /**
   * Perform the current mode of operation on the page.
   */
  run: function() {

    //create and correct the links pointing
    //to Privly content
    privly.createLinks();
    privly.correctIndirection();

    //replace all available links on load, if in active mode,
    //otherwise replace all links default behavior
    privly.replaceLinks();
  },

  /*
   * Reference to background Process Window.
   * Used to avoid unnecessary Messaging Calls for inter-process communication.
  */
  bgProcess: "",

  /**
   * runs privly once then registers the update listener
   * for dynamic pages
   */
  listeners: function() {    
    //The content's iframe will post a message to the hosting document.
    //This listener sets the height of the iframe according to the messaged height
    window.addEventListener("message", privly.resizeIframe, false, true);
    var fBody = document.getElementsByTagName("body")[0];
    if(fBody != null && fBody.getAttribute("privly-exclude")=="true") {
      return;
    }
    //else {
    privly.runPending=true;
    setTimeout(function() {
      privly.runPending=false;
      privly.run();
    }, 100);

    //Everytime the page is updated via javascript, we have to check
    //for new Privly content. This might not be supported on other platforms
    document.addEventListener("DOMNodeInserted", function(event) {

      //we check the page a maximum of two times a second
      if(privly.runPending ) {
        return;
      }
      privly.runPending=true;	  

      setTimeout( function() {
        privly.runPending=false;
        privly.run();
      }, 500);

      /*   
       * Adds event listeners to text boxes to detect change in content.
      */
      var inputTags = document.querySelectorAll("input[type='text']"); 
      for (i=0; i < inputTags.length; i++) {	 
        inputTags[i].onchange=function() {			
          //opera.extension.bgProcess.content = window.event.target.value;
          //TODO: Remove inputLocation. REFER: background.js::postInfo
          privly.bgProcess.postMessage({message: window.event.target.value,
            type: "contentPost", inputTag: "input", inputLocation: i});
          //window.event.target.value = window.event.target.value.toUpperCase();
          //int=self.setInterval("alertit()",3000);
        }
      }

      for (i=0; i < document.getElementsByTagName("textarea").length; i++) {	 

        document.getElementsByTagName("textarea")[i].onchange=function() {			
          //opera.extension.bgProcess.content = window.event.target.value;
          privly.bgProcess.postMessage({message: window.event.target.value,
            type: "contentPost", inputTag: "textarea", inputLocation: i});			
        }
      }
    });

    //Opera specific Code (written by Sanchit Karve)
    //TODO: Clean up code and add comments to explain what this does

    /*document.addEventListener("change", function(event) {


    });*/

    /*opera.extension.onmessage = function(event){
    var thecatch = event.data; // event.data in this case will contain the string "Hello there"
    };*/
    
    /*
     * Contains Inter-script communication code. Handles events sent by
     * the extension's main script.
    */
    opera.extension.onmessage = function(event) {
      // Get content of incoming message.
      //opera.postError("inside onmsg");
      var d  = event.data;
      if(d.type == "privly:init")	{
        privly.bgProcess = event.source;
        //opera.postError("Background process sent");
      }
      if(d.type == "postContentSuccess") {
        if(d.post.postTag == "textarea") {
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
              if(hiddenInputTags[i].value == d.post.content) {
                hiddenInputTags[i].onchange = null;												
                hiddenInputTags[i].value = d.message;
              }
            }
          }
        }

        if(d.post.postTag == "input") {				
          var inputTags = document.querySelectorAll("input[type='text']"); 
          for (i=0; i < inputTags.length; i++) {
            if(inputTags[i].value == d.post.content) {
              inputTags[i].onchange = null;												
              inputTags[i].value = d.message;
            }
          }
        }
      }

      //if(d.type == "postContentFailed") {
      //opera.postError("postContentFailed");
      //}

      if(d.type == "extensionModeChange")	{
        //opera.postError("premodechange: " + d.mode);
        privly.extensionMode = d.mode;
        //opera.postError("postmodechange: " + d.mode);
      }

      // Replies back to background script.
      //var reply = "Background process's message only had " + (message ? message.length : 0) + " characters.";
      //privly.bgProcess.postMessage(reply); 
    };
    //}
  }
};

privly.listeners();