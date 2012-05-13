// Quick-Hack to load JQuery before Background process loads.
document.write("<script type=\"text/javascript\" src=\"scripts/jquery-1.7.2.min.js\"></script>");

// Add a button to Opera's toolbar when the extension loads.
window.addEventListener("load", function() {
	// Buttons are members of the UIItem family.
	// Firstly we set some properties to apply to the button.
	var UIItemProperties = {
		//disabled: false,  The button is disabled.
		title: "Privly", // The tooltip title.
		icon: "icons/logo_64.png", // The icon (18x18) to use for the button.
		popup: {                // Popup is just being used for testing purposes.
            href: "popup.html",
            width: 200,
            height: 320
          },
		badge: {
            	display: "none",
            	textContent: "A",
            	color: "white",
                backgroundColor: "rgba(211, 0, 4, 1)"
        }
		/*onclick: function() {
			// Send a message to the currently-selected tab.
			var tab = opera.extension.tabs.getFocused();
			if (tab) { // Null if the focused tab is not accessible by this extension
				//TODO: Use this button onClickHandler to submit content to Privly (Allow user to select option)
				//tab.postMessage('go');
			}
		}*/
	};  

	// Next, we create the button and apply the above properties.
    extensionButton = opera.contexts.toolbar.createItem(UIItemProperties);
    // Finally, we add the button to the toolbar.
    opera.contexts.toolbar.addItem(extensionButton);
	
	if(widget.preferences.authToken) {
		privlyAuthentication.setAuthToken(widget.preferences.authToken);		
	}
	else {
		privlyAuthentication.setAuthToken("");
	}
    
	function enableButton() {
		var tab = opera.extension.tabs.getFocused();
		if (tab) {
			extensionButton.disabled = false;
		} else {
			extensionButton.disabled = true;
		}
	}	
	
	// Enable the button when a tab is ready.
	// Prevents user from attempting to post content when no tabs are open.
	//opera.extension.onconnect = enableButton;
	//opera.extension.tabs.onfocus = enableButton;
	//opera.extension.tabs.onblur = enableButton;	 
	
	opera.extension.onconnect = function(event)	{
        // Post message to the source, that is, the thing which connected to us (in this case the injected script) 
		event.source.postMessage({type: "privly:init"}); 
        // Post this message in the opera error console
		//opera.postError("sent privly:init");
   }
   
   // Listen for messages                
   opera.extension.onmessage = function(event) {		
		if(event.data.type == "contentPost") {
			postInfo.content = event.data.message;
			postInfo.postTag = event.data.inputTag;
			postInfo.postLocation = event.data.inputLocation;
		}
       	// Post a sentence (which includes the message received) to the opera error console
       //opera.postError("This is what I got from injected script: "+event.data);
   }
	
}, false);

// Reference to the extension's button
var extensionButton;
 
 /*
 * enum to hold various extension modes and their value. extension modes are set through Opera's
 * extension api.
 */ 
var extensionModeEnum = {
	ACTIVE : 0,
    PASSIVE : 1,
    CLICKTHROUGH : 2
};

//TODO: Remove postLocation and related code. No longer needed.
var postInfo = {
	content : "",
	postTag : "",
	postLocation : ""
};

function broadcastModeChange(newMode) {
		opera.postError("initiate broadcast mode call");
		opera.extension.broadcastMessage({type : "extensionModeChange", mode: newMode});		
}

//BEGIN (modded) authentication.js from Firefox Extension
// Manages sessions for the content server

var privlyAuthentication = {
  //When added to every request to the content server
  //as the parameter auth_token, the extension has access
  //to the referenced user account
  authToken: "",  
  
  setAuthToken : function(auth) {
	privlyAuthentication.authToken = auth;
	widget.preferences.authToken = auth;
  },
  
  getAuthToken : function() {
	return privlyAuthentication.authToken;	
  },
  
  //get a new auth token
  loginToPrivly : function(userEmailAddress, userPassword) {
		// Opera 11.x does not support cross-origin scripting.
		// Rumors suggest Opera 12 will fix it.
		// Until then, jQuery provides a nice hack.
		$.support.cors = true;
		//opera.postError('pre-login-ajax');
                                                
    $.ajax(	{
	    //TODO: Get version number directly from config.xml
        data: { email: userEmailAddress, password: userPassword,
          endpoint:"extension", browser:"opera", version:"0.1.1.3"
        },
        type: "POST",
		//TODO:Use opera.widgets.preferences to store contentServerUrl and other strings. Remove hardcoded url
        //url: privlyExtension.preferences.getCharPref("contentServerUrl")+"/token_authentications.json",
		url: "https://priv.ly/token_authentications.json",	
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
        dataType: "json",
        accepts: "json",
        success: function(data, textStatus, jqXHR){          
		  privlyAuthentication.setAuthToken(data.auth_key);
          if(privlyAuthentication.getAuthToken()) {		    
			//opera.postError('loginsuccess');
			//Broadcast Success Message to Preferences Page (options.html)
			opera.extension.broadcastMessage({type : "loginSuccess"});			
          }
          else {	
			//Broadcast Login Failed Message to Preferences Page (options.html)
			privlyAuthentication.setAuthToken("");
			//opera.postError('loginfailed');
			opera.extension.broadcastMessage({type : "loginFailed"});			
          }
        },
        error: function(data, textStatus, jqXHR) {            
			//Broadcast Server Error Message to Preferences Page (options.html)
			//opera.postError('unreachable');
			opera.extension.broadcastMessage({type : "loginServerUnreachable"});			
        }
      }
    );	
  },
  
  //get a new auth token
  postToPrivly : function() {
		// Opera 11.x does not support cross-origin scripting.
		// Rumors suggest Opera 12 will fix it.
		// Until then, jQuery provides a nice hack.
		$.support.cors = true;
                                                
    $.ajax({
	    //TODO: Get version number directly from config.xml
        data: { auth_token: privlyAuthentication.authToken, "post[content]":postInfo.content,
          endpoint:"extension", browser:"opera", version:"0.1.1.3"
        },
        type: "POST",
		//TODO:Use opera.widgets.preferences to store contentServerUrl and other strings. Remove hardcoded url
        //url: privlyExtension.preferences.getCharPref("contentServerUrl")+"/token_authentications.json",
		url: "https://priv.ly/posts",	
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",        
        success: function(data, textStatus, jqXHR){		    
			//Broadcast Success Message to Preferences Page (options.html)
			opera.extension.broadcastMessage({type: "postContentSuccess", message:jqXHR.getResponseHeader("privlyurl"), post: postInfo});			
			postInfo.content = "";
                    
        },
        error: function(data, textStatus, jqXHR) {            
			//Broadcast Server Error Message to Preferences Page (options.html)
			opera.extension.broadcastMessage({type: "postContentFailed"});					
        }
      }
    );	
  },
  
  //destroy the auth token  
  logoutFromPrivly : function() {
		// Opera 11.x does not support cross-origin scripting.
		// Rumors suggest Opera 12 will fix it.
		// Until then, jQuery provides a nice hack.
		$.support.cors = true;
		//opera.postError("pre-ajax");
		
    $.ajax({
        data: { _method: "delete", endpoint:"extension", browser:"opera", 
          version:"0.1.1.3", auth_token: privlyAuthentication.getAuthToken()
        },
        type: "POST",
        //url: privlyExtension.preferences.getCharPref("contentServerUrl")+"/token_authentications.json",
		url: "https://priv.ly/token_authentications.json",	
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
        dataType: "json",
        accepts: "json",
        success: function(data, textStatus, jqXHR){
          privlyAuthentication.setAuthToken("");
          //alert("You are logged out from Priv.ly");
		  //opera.postError("S");
		  opera.extension.broadcastMessage({type : "logoutSuccess"});					  
        },
        error: function(data, textStatus, jqXHR){
          //alert(data.error);
		  //opera.postError("F");
		  opera.extension.broadcastMessage({type : "logoutFailure", message: data.error});			
        }
      }
    );
  }
}