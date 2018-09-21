
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
	
	if(!selection.isCollapsed)
		console.log(selection);
	
	if(selection.type !== 'Range')
		return;
	
	let highlightData = getHighlightDataFromSelection(selection);
	
	insertHighlightData(highlightData);
	
	applyHighlight(highlightData);
	
	
	let updateRequest = {
		updatetype: UpdateType.insert,
		highlights: highlights
	};
	
	chrome.runtime.sendMessage(updateRequest, function(){});
});


chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
	highlights = JSON.parse(request);
	highlights.forEach(function(highlightData, i){
		
		
		highlightData.range = void(0);  // TODO: look into just removing this from the object that is saved
		
		applyHighlight(highlightData);
		
	});
	
  });

function getHighlightDataFromSelection(selection){
	
	let selectionDirection = getSelectionDirection(selection);
	let startNode = selectionDirection === SelectionDirection.forward ?  selection.anchorNode : selection.focusNode;
	let endNode = selectionDirection === SelectionDirection.forward ? selection.focusNode : selection.anchorNode;
	let startNodeOffset = selectionDirection === SelectionDirection.forward ? selection.anchorOffset : selection.focusOffset;
	let endNodeOffset = selectionDirection === SelectionDirection.forward ? selection.focusOffset : selection.anchorOffset;
		
	// let highlightData = {
					// pathToStartNode: getPathTo(startNode),
					// startNodeOffset: startNodeOffset,
					// startNodeTextHash: selection.toString(),
					// pathToEndNode: getPathTo(endNode),
					// endNodeOffset: endNodeOffset,
					// endNodeTextHash: selection.toString(),
					// range: void(0)
	// };
	
	// TODO: we need to handle scenario where parent node is a span we created
	
	let highlightData = {
		pathToStartNodeParent: getPathTo(startNode.parentNode),
		startOffsetRelativeToParent: getParentOffsetFromContainingNodeAndOffset(startNode, startNodeOffset),
		pathToEndNodeParent: getPathTo(endNode.parentNode),
		endOffsetRelativeToParent: getParentOffsetFromContainingNodeAndOffset(endNode, endNodeOffset),
		range: void(0)
	};
	
	return highlightData;
	
}


function insertHighlightData(newData){

	let range = document.createRange();
	let start = getContainingNodeAndOffsetFromParentPathAndOffset(newData.pathToStartNodeParent, newData.startOffsetRelativeToParent);
	range.setStart(start.containingNode, start.offset);
	
	let end = getContainingNodeAndOffsetFromParentPathAndOffset(newData.pathToEndNodeParent, newData.endOffsetRelativeToParent);
	range.setEnd(end.containingNode, end.offset);
	newData.range = range;
	
	console.log('new range');
	console.log(range);
	
	let overlaps = [];
	let firstOverlap_i = -1;
	let firstHighlightToTheRight_i = -1;
	
	// collect existing highlights that overlap with the new highlight
	highlights.every(function(existingHighlight, i){
		let newStartIsBeforeOldEnd = newData.range.compareBoundaryPoints(Range.END_TO_START, existingHighlight.range) <= 0;
		let newEndIsAfterOldStart = newData.range.compareBoundaryPoints(Range.START_TO_END, existingHighlight.range) >= 0;
		let newStartIsAfterOldStart = newData.range.compareBoundaryPoints(Range.START_TO_START, existingHighlight.range) >= 0;
		
		
		//console.log(`newStartIsBeforeOldEnd: ${newStartIsBeforeOldEnd} newEndIsAfterOldStart: ${newEndIsAfterOldStart}`);
		
		
		if(newStartIsBeforeOldEnd && newEndIsAfterOldStart){
			overlaps.push(existingHighlight);
			
			if(firstOverlap_i < 0)
				firstOverlap_i = i;
		}
		
		firstHighlightToTheRight_i++;
		
		if(!newEndIsAfterOldStart)
			return false;
		
		return true;
		
	});
		
	if(overlaps.length === 0){
		highlights.splice(firstHighlightToTheRight_i, 0, newData);
	}
	else{
		overlaps.forEach(function(existingHighlight){
			let newStartIsAfterOldStart = newData.range.compareBoundaryPoints(Range.START_TO_START, existingHighlight.range) > 0;
			let newEndIsBeforeOldEnd = newData.range.compareBoundaryPoints(Range.END_TO_END, existingHighlight.range) < 0;
			
			let existingRange = existingHighlight.range;
			
			//console.log(`newStartIsAfterOldStart: ${newStartIsAfterOldStart} newEndIsBeforeOldEnd: ${newEndIsBeforeOldEnd}`);
			
			if(newStartIsAfterOldStart){
				newData.range.setStart(existingRange.startContainer, existingRange.startOffset);
				newData.pathToStartNodeParent = existingHighlight.pathToStartNodeParent;
				newData.startOffsetRelativeToParent = existingHighlight.startOffsetRelativeToParent;
			}
			
			if(newEndIsBeforeOldEnd){
				newData.range.setEnd(existingRange.endContainer, existingRange.endOffset);
				newData.pathToEndNodeParent = existingHighlight.pathToEndNodeParent;
				newData.endOffsetRelativeToParent = existingHighlight.endOffsetRelativeToParent;
			}
			
			
		});
		
		console.log(`firstHighlightToTheRight_i: ${firstHighlightToTheRight_i}, firstOverlap_i: ${firstOverlap_i}, overlaps.length ${overlaps.length}`);
		
		// replace existing highlights with new overarching highlight
		highlights.splice(firstOverlap_i, overlaps.length, newData);
	}
	
	console.log('final highlights:');
	console.log(highlights);
	
	// remove overlaps
	// we'll need to clean up the css from the replaced highlights and then detach their ranges
	overlaps.forEach(function(replacedHighlight, i){
		removeHighlightCss(replacedHighlight);
		replacedHighlight.range.detach();
	});
	
	
}

function removeHighlightCss(highlightData){
	let range = highlightData.range;
	
	if(range.startContainer === range.endContainer){
		if(range.startContainer.dataset.hi5Generated === "true"){
			console.log('hi5 generated - unwrapping');
			
			let highlightedNode = range.startContainer;
			console.log(highlightedNode);
			
			if(highlightedNode.nextSibling && highlightedNode.nextSibling.nodeType === Node.TEXT_NODE){
				highlightedNode.childNodes[0].nodeValue += highlightedNode.nextSibling.nodeValue;
				highlightedNode.parentNode.removeChild(highlightedNode.nextSibling);
			};
			
			if(highlightedNode.previousSibling && highlightedNode.previousSibling.nodeType === Node.TEXT_NODE){
				highlightedNode.previousSibling.nodeValue += highlightedNode.childNodes[0].nodeValue;
				highlightedNode.parentNode.removeChild(highlightedNode);
			};
			
			console.log(parent.childNodes);
		}
		else{
			range.startContainer.classList.remove(highlightCssClassName);
		}
	}

}

function getParentOffsetFromContainingNodeAndOffset(containingNode, offsetRelativeToContainingNode){
	let parentNode = containingNode.parentNode;
	
	let offsetRelativeToParent = 0;
	
	for(let i = 0; i < containingNode.parentNode.childNodes.length; i++){
	  
	  let childNode = parentNode.childNodes[i];
		
		if(childNode === containingNode){
			offsetRelativeToParent += offsetRelativeToContainingNode;
			return offsetRelativeToParent;
		}
			
		if(childNode.nodeType === Node.TEXT_NODE)
			offsetRelativeToParent += childNode.textContent.length;
		else if (childNode.tagName === highlightedTagName)
			offsetRelativeToParent += childNode.textContent.length;
	}
	
	
	throw `Error converting containing node to parent. Path to node:${getPathTo(containingNode)} offset:${offsetRelativeToContainingNode}`;
	
}

function getContainingNodeAndOffsetFromParentPathAndOffset(parentPath, offsetRelativeToParent){
	
	let parentNode = document.evaluate('//' + parentPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    let charactersRemaining = offsetRelativeToParent;
  
    let containingNodeAndOffset = [];
  
    for(let i = 0; i < parentNode.childNodes.length; i++){
	  
        let childNode = parentNode.childNodes[i];
    
        if(childNode.nodeType === Node.TEXT_NODE || childNode.tagName === 'SPAN'){
    
            if(childNode.textContent.length >= charactersRemaining){
		        containingNodeAndOffset = {
			        containingNode: childNode,
			        offset: charactersRemaining
		            };
		
                return containingNodeAndOffset;
            }
            else{
                charactersRemaining -= childNode.textContent.length;
            }
        }
    }
  
	throw `Error converting parent node to containing node. Path to parent:${getPathTo(parentNode)} offset:${offsetRelativeToParent}`;
}
  

function getInBetweenNodes(highlightData){
	
	
	console.log('in between nodes:');
	console.log(highlightData);
	
	if(highlightData.pathToStartNodeParent === highlightData.pathToEndNodeParent)
		return [];
	
	let sharedAncestorNode = highlightData.range.commonAncestorContainer;
	
    // if no shared path, that's weird, return empty array
	if(!sharedAncestorNode){
		return [];
	}
	
	let startNode = highlightData.range ? 
					highlightData.range.startContainer : 
					getContainingNodeAndOffsetFromParentPathAndOffset(highlightData.pathToStartNodeParent, highlightData.startOffsetRelativeToParent).containingNode;
	let endNode = highlightData.range ? 
					highlightData.range.endContainer : 
					getContainingNodeAndOffsetFromParentPathAndOffset(highlightData.pathToEndNodeParent, highlightData.endOffsetRelativeToParent).containingNode;
	
	let nodesInBetween = [];
	
	// get nodes to the right of the first node
	console.log('FIRST NODE BRANCH:');
	let currentNode = getRightSideSiblingOrAncestor(startNode);
	while(currentNode && currentNode.parentNode !== sharedAncestorNode){
		nodesInBetween.push(currentNode);
		console.log(getPathTo(currentNode));	
		currentNode = getRightSideSiblingOrAncestor(currentNode, sharedAncestorNode);
	}
	
	let startNodeAncestorNode = currentNode;
	
	// get nodes to the left of the last node
	console.log('LAST NODE BRANCH');
	currentNode = getLeftSideSiblingOrAncestor(endNode, sharedAncestorNode);
	while(currentNode && currentNode.parentNode !== sharedAncestorNode){
		
		nodesInBetween.push(currentNode);
		console.log(getPathTo(currentNode));
		currentNode = getLeftSideSiblingOrAncestor(currentNode, sharedAncestorNode);
	}
	
	let endNodeAncestorNode = currentNode;
	
	// get nodes in between left and right ancestors
	if(!startNodeAncestorNode || !endNodeAncestorNode || (startNodeAncestorNode.parentNode !== endNodeAncestorNode.parentNode)){
		// this is weird
		return [];
	}
	
	currentNode = startNodeAncestorNode;
	
	console.log('NODES IN BETWEEN:');
	while(currentNode !== endNodeAncestorNode)
	{
		nodesInBetween.push(currentNode);
		console.log(getPathTo(currentNode));
		currentNode = currentNode.nextSibling;
	}
	
	// filter out empy text nodes
	nodesInBetween = nodesInBetween.filter(function(node){
		return /\S/.test(node.textContent);
	});
	
	return nodesInBetween;
}

function applyHighlight(highlightData){
	
	// highlight first and last nodes
	//let tempStartPath = 'BODY/DIV[2]/SECTION[1]/SECTION[1]/DIV[1]/DIV[1]/H2[1]/text()[1]';
	let start = getContainingNodeAndOffsetFromParentPathAndOffset(highlightData.pathToStartNodeParent, highlightData.startOffsetRelativeToParent);
	let end = getContainingNodeAndOffsetFromParentPathAndOffset(highlightData.pathToEndNodeParent, highlightData.endOffsetRelativeToParent);
	
	if(start.containingNode === end.containingNode){
		let range = insertRangeWithHighlightedNode(start.containingNode, start.offset, end.offset);
		highlightData.range = range;
		return;
	}
	
	let newStartNode = insertRangeWithHighlightedNode(start.containingNode, start.offset, start.containingNode.textContent.length).startContainer;
	let newEndNode = insertRangeWithHighlightedNode(end.containingNode, 0, end.offset).startContainer;

	
	let range = document.createRange();
	range.setStart(newStartNode, 0);
	range.setEnd(newEndNode, 1);
	highlightData.range = range;
	
	// highlight the nodes in between
	let inBetweenNodes = getInBetweenNodes(highlightData);
	
	inBetweenNodes.forEach(function(node, i){
		console.log(node);
		if(node.nodeType === Node.TEXT_NODE){
			let range = document.createRange();
			range.selectNode(node);
			
			var span = document.createElement(highlightedTagName);
			span.classList.add(highlightCssClassName);
			span.dataset.hi5Generated = true;
			range.surroundContents(span);
			range.detach();
			
			node = span;
		
		}
		node.classList.add(highlightCssClassName);
	});
	
}

function insertRangeWithHighlightedNode(node, startIndex, endIndex){
	
	console.log(`insertRangeWithHighlightedNode start i:${startIndex} end i:${endIndex}`);
	console.log([node]);

	let range = document.createRange();
	range.setStart(node, startIndex);
	range.setEnd(node, endIndex);
	var span = document.createElement(highlightedTagName);
	span.classList.add(highlightCssClassName);
	span.dataset.hi5Generated = true;

	range.surroundContents(span);
	range.detach();
	
	// create new range that represents that span's text
	let newRange = document.createRange();
	newRange.selectNodeContents(span);
	return newRange;
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
		return `${element.tagName}[@id='${element.id}']`
	if (element===document.body)
		return element.tagName;

	var elmnt_i= 0;
	var text_i = 0;
	var siblings= element.parentNode.childNodes;
	for (var i= 0; i<siblings.length; i++) {
		var sibling= siblings[i];
		if (sibling===element){
			if(element.nodeType === Node.TEXT_NODE)
				return getPathTo(element.parentNode)+'/text()['+(text_i+1)+']';
			else
				return getPathTo(element.parentNode)+'/'+element.tagName+'['+(elmnt_i+1)+']';
		}
			
		if (sibling.nodeType=== Node.ELEMENT_NODE && sibling.tagName===element.tagName)
			elmnt_i++;
		if(sibling.nodeType === Node.TEXT_NODE)
			text_i++;
	}
}

String.prototype.getHashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

var highlightCssClassName = 'highlight';

var highlightedTagName = 'SPAN';

var highlights = [];

var SelectionDirection = Object.freeze({"forward":1, "backward":2})

var UpdateType = Object.freeze({"insert":1, "remove":2});
