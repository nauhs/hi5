
document.addEventListener('mouseup', function() {
	
	var selection;
    if (window.getSelection) {
        selection = window.getSelection();
    } else if (document.selection && document.selection.type != "Control") {
        selection = document.selection.createRange();
    }
	else{
		console.log('none');
		return;
	}
	
	console.log(selection);
	
	if(selection.type !== 'Range')
		return;
	
	var selectionDirection = getSelectionDirection(selection);
	//var firstNodePath = selectionDirection === SelectionDirection.forward ?  getPathTo(selection.anchorNode) : getPathTo(selection.focusNode);
	//var lastNodePath = selectionDirection === SelectionDirection.forward ?  getPathTo(selection.focusNode) : getPathTo(selection.anchorNode);
	var firstNode = selectionDirection === SelectionDirection.forward ?  selection.anchorNode : selection.focusNode;
	var lastNode = selectionDirection === SelectionDirection.forward ? selection.focusNode : selection.anchorNode;
	
	var inBetweenNodes = getInBetweenNodes(getPathTo(firstNode), getPathTo(lastNode));
	
	console.log('IN BETWEEN NODES');
	console.log(inBetweenNodes);
	
	var firstNodeOffset = selectionDirection === SelectionDirection.forward ? selection.anchorOffset : selection.focusOffset;
	var lastNodeOffset = selectionDirection === SelectionDirection.forward ? selection.focusOffset : selection.anchorOffset;
	
	
	applyHighlight(firstNode, firstNodeOffset, lastNode, lastNodeOffset, inBetweenNodes);
	//createCookie(getPathTo(firstNode), getPathTo(lastNode), firstNodeOffset, lastNodeOffset, 'hey', 'last');

});

function createCookie(pathToFirstNode, pathToLastNode, firstNodeOffset, lastNodeOffset, firstNodeText, lastNodeText){
	
	let data = {
					pathToFirstNode: pathToFirstNode,
					firstNodeOffset: firstNodeOffset,
					firstNodeTextHash: firstNodeText.hashCode,
					pathToLastNode: pathToLastNode,
					lastNodeOffset: lastNodeOffset,
					lastNodeTextHash: lastNodeText.hashCode
	};
	

	
	console.log(window.location.toString());
	
}

String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

function getInBetweenNodes(pathToFirstNode, pathToLastNode){
	
	if(pathToFirstNode === pathToLastNode)
		return [];
	
	
	let pathToSharedAncestorNode = getPathToSharedAncestor(pathToFirstNode, pathToLastNode);
	console.log('path to shared ancestor: ' + pathToSharedAncestorNode);
	
    // if no shared path, that's weird, return empty array
	if(pathToSharedAncestorNode.length === 0){
		return [];
	}
	
	let sharedAncestorNode = document.evaluate('//' + pathToSharedAncestorNode, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	let lastNode = document.evaluate('//' + pathToLastNode, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	let firstNode = document.evaluate('//' + pathToFirstNode, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	
	let nodesInBetween = [];
	
	// get nodes to the right of the first node
	console.log('FIRST NODE BRANCH:');
	let currentNode = getRightSideSiblingOrAncestor(firstNode);
	while(currentNode && currentNode.parentNode !== sharedAncestorNode){
		
		nodesInBetween.push(currentNode);
		console.log(getPathTo(currentNode));
		currentNode = getRightSideSiblingOrAncestor(currentNode, sharedAncestorNode);
	}
	
	let firstNodeAncestorNode = currentNode;
	
	// get nodes to the left of the last node
	console.log('LAST NODE BRANCH');
	currentNode = getLeftSideSiblingOrAncestor(lastNode, sharedAncestorNode);
	while(currentNode && currentNode.parentNode !== sharedAncestorNode){
		
		nodesInBetween.push(currentNode);
		console.log(getPathTo(currentNode));
		currentNode = getLeftSideSiblingOrAncestor(currentNode, sharedAncestorNode);
	}
	
	let lastNodeAncestorNode = currentNode;
	
	// get nodes in between left and right ancestors
	if(!firstNodeAncestorNode || !lastNodeAncestorNode || (firstNodeAncestorNode.parentNode !== lastNodeAncestorNode.parentNode)){
		// this is weird
		return [];
	}
	
	currentNode = firstNodeAncestorNode;
	
	console.log('NODES IN BETWEEN:');
	while(currentNode !== lastNodeAncestorNode)
	{
		nodesInBetween.push(currentNode);
		console.log(getPathTo(currentNode));
		currentNode = currentNode.nextSibling;
	}
	
	return nodesInBetween;
}

function applyHighlight(firstNode, firstNodeOffset, lastNode, lastNodeOffset, inBetweenNodes){
	
	if(firstNode === lastNode){
		applyHighlightToPartialText(firstNode, firstNodeOffset, lastNodeOffset);
		return;
	}
	
	applyHighlightToPartialText(firstNode, firstNodeOffset, firstNode.length);
	applyHighlightToPartialText(lastNode, 0, lastNodeOffset);
	
	inBetweenNodes.forEach(function(node, i){
			node.className += ' highlight';
	});
	
}

function applyHighlightToPartialText(node, startIndex, endIndex){
	let range = document.createRange();
	range.setStart(node, startIndex);
	range.setEnd(node, endIndex);
	var span = document.createElement("span");
	span.style.backgroundColor = "#FFAADD";

	range.surroundContents(span);
}

function getPathToSharedAncestor(pathToFirstNode, pathToLastNode){
	let i = 0;
	let firstNodeAncestors = pathToFirstNode.split('/');
	let lastNodeAncestors = pathToLastNode.split('/');
	while(i < firstNodeAncestors.length && i < lastNodeAncestors.length &&
		  firstNodeAncestors[i] == lastNodeAncestors[i])
		  i++;
	
	return i === 0 ? '' : firstNodeAncestors.slice(0,i).join('/');
}
	
function getRightSideSiblingOrAncestor(node, sharedAncestorNode){
	while(!node.nextSibling){
		if(node.parentNode === sharedAncestorNode)
			return null;
		node = node.parentNode;
	}
	return node.nextSibling;
}


function getLeftSideSiblingOrAncestor(node, sharedAncestorNode){
	while(!node.previousSibling){
		if(node.parentNode === sharedAncestorNode)
			return null;
		node = node.parentNode;
	}
	return node.previousSibling;
}

function getSelectionDirection(selection){
	var direction = SelectionDirection.forward;
	position = selection.anchorNode.compareDocumentPosition(selection.focusNode);
	// position == 0 if nodes are the same
	if (!position && selection.anchorOffset > selection.focusOffset || 
	  position === Node.DOCUMENT_POSITION_PRECEDING)
	  direction = SelectionDirection.backward;
		
	return direction;
}


function getPathTo(element) {
	if (element.id!=='' && (typeof element.id !== 'undefined'))
		return 'id("'+element.id+'")';
	if (element===document.body)
		return element.tagName;

	var ix= 0;
	var siblings= element.parentNode.childNodes;
	for (var i= 0; i<siblings.length; i++) {
		var sibling= siblings[i];
		if (sibling===element){
			if(element.nodeType === Node.TEXT_NODE)
				return getPathTo(element.parentNode)+'/text()['+(ix+1)+']';
			else
				return getPathTo(element.parentNode)+'/'+element.tagName+'['+(ix+1)+']';
		}
			
		if (sibling.nodeType===1 && sibling.tagName===element.tagName)
			ix++;
	}
}

var SelectionDirection = Object.freeze({"forward":1, "backward":2})
