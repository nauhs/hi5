

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
	console.log('message received.  request...');
	console.log(request);
	
	
	//highlights.push(request.highlightData);
	chrome.cookies.set({ url: sender.url, name: "CookieVar", value: JSON.stringify(request.highlights), expirationDate: 1567665999 });
	
});

chrome.webNavigation.onCompleted.addListener(function(details) {
	if(details.frameId === 0){
		console.log('web navigation completed...');
		console.log(details);
		chrome.cookies.get({
				url: details.url,
				name: 'CookieVar'
			},
			function(cookie){
				console.log(cookie);
				if(cookie){
					chrome.tabs.sendMessage(details.tabId, cookie.value, function(response) {});
				}
			}
		);
	}
	
});



