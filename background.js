// Quick-Hack to load JQuery before Background process loads.
document.write("<script type=\"text/javascript\" src=\"scripts/jquery-1.6.3.min.js\"></script>");
// Add a button to Opera's toolbar when the extension loads.
window.addEventListener("load", function() {
	// Buttons are members of the UIItem family.
	// Firstly we set some properties to apply to the button.
	var UIItemProperties = {
		disabled: true, // The button is disabled.
		title: "Privly", // The tooltip title.
		icon: "icons/logo_64.png", // The icon (18x18) to use for the button.
		popup: {                // Popup is just being used for testing purposes.
            href: "popup.html",
            width: 310,
            height: 300
          }
		/*onclick: function() {
			// Send a message to the currently-selected tab.
			var tab = opera.extension.tabs.getFocused();
			if (tab) { // Null if the focused tab is not accessible by this extension
				//TODO: Use this button onClickHandler to submit content to Privly
				//tab.postMessage('go');
			}
		}*/
	};

	// Next, we create the button and apply the above properties.
    var button = opera.contexts.toolbar.createItem(UIItemProperties);
    // Finally, we add the button to the toolbar.
    opera.contexts.toolbar.addItem(button);
    
	function enableButton() {
		var tab = opera.extension.tabs.getFocused();
		if (tab) {
			button.disabled = false;
		} else {
			button.disabled = true;
		}
	}
	
	// Enable the button when a tab is ready.
	// Prevents user from attempting to post content when no tabs are open.
	opera.extension.onconnect = enableButton;
	opera.extension.tabs.onfocus = enableButton;
	opera.extension.tabs.onblur = enableButton;	 
	
}, false);

//BEGIN (modded) authentication.js from Firefox Extension

// Manages sessions for the content server

var privlyAuthentication = 
{
  //When added to every request to the content server
  //as the parameter auth_token, the extension has access
  //to the referenced user account
  authToken: "",  
  
  //get a new auth token
  loginToPrivly : function(userEmailAddress, userPassword)
  {
		// Opera 11.x does not support cross-origin scripting.
		// Opera says Opera 12 will fix it.
		// Until then, jQuery provides a nice hack.
		$.support.cors = true;
                                                
    $.ajax(
		{
	    //TODO: Get version number directly from config.xml
        data: { email: userEmailAddress, password: userPassword,
          endpoint:"extension", browser:"opera", version:"0.1.1.0"
        },
        type: "POST",
		//TODO:Use opera.widgets.preferences to store contentServerUrl and other strings. Remove hardcoded url
        //url: privlyExtension.preferences.getCharPref("contentServerUrl")+"/token_authentications.json",
		url: "https://priv.ly/token_authentications.json",	
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
        dataType: "json",
        accepts: "json",
        success: function(data, textStatus, jqXHR){
          privlyAuthentication.authToken = data.auth_key;
          if(privlyAuthentication.authToken)
          {		    
			//Broadcast Success Message to Preferences Page (options.html)
			opera.extension.broadcastMessage( "loginSuccess");			
          }
          else
          {	
			//Broadcast Login Failed Message to Preferences Page (options.html)
			opera.extension.broadcastMessage( "loginFailed");			
          }
        },
        error: function(data, textStatus, jqXHR)
		{            
			//Broadcast Server Error Message to Preferences Page (options.html)
			opera.extension.broadcastMessage( "loginServerUnreachable");			
        }
      }
    );	
  },
  
  //destroy the auth token
  //TODO: Mod for Opera
  logoutFromPrivly : function()
  {
    jQ.ajax(
      {
        data: { _method: "delete", endpoint:"extension", browser:"firefox", 
          version:"0.1.1.1", auth_token: privlyAuthentication.authToken
        },
        type: "POST",
        url: privlyExtension.preferences.getCharPref("contentServerUrl")+"/token_authentications.json",
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
        dataType: "json",
        accepts: "json",
        success: function(data, textStatus, jqXHR){
          privlyAuthentication.authToken = "";
          alert("You are logged out from Priv.ly");
        },
        error: function(data, textStatus, jqXHR){
          alert(data.error);
        }
      }
    );
  }
}