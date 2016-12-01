var WikiTemplateParser = (function(){
	'use strict';

	ctor.prototype.updateTamplateFromData = updateTamplateFromData;
	ctor.prototype.updateDataFromTemplete = updateDataFromTemplete;
	
	return ctor;
	
	function ctor(articleContent, templateName) {
		this._articleContent = articleContent;
		this._templateName = templateName;
		this.templateText = findTamplateText(templateName, articleContent);
		this.updateDataFromTemplete(this.templateText);
	}

	function updateTamplateFromData(templateData = this.templateData, 
		templateName = this._templateName){
		
		var tamplateStr = `{{${templateName}\n`;
		var value;
		for (let key in templateData) {
			value = templateData[key];
			tamplateStr += `|${key}=${value}\n`;
		}
		tamplateStr += "}}";
		this.templateText = tamplateStr;
		
		return tamplateStr;
	}
	
	function updateDataFromTemplete(templateText = this.templateText) {
		var obj = {};
		if (templateText) {
			var currIndex = templateText.indexOf('|') + 1;
			
			var pipeSignIndex;
			var key;
			var value;
			var equalSignIndex;
			var isTemplateEnd = false;
			while (!isTemplateEnd) {
				equalSignIndex = templateText.indexOf('=', currIndex);
				key = templateText.substring(currIndex, equalSignIndex).trim();
				pipeSignIndex = WikiParser.nextWikiText(templateText, currIndex, '|');
				isTemplateEnd = pipeSignIndex === -1;
				
				if (isTemplateEnd) {
					value = templateText.substring(equalSignIndex+1, templateText.length-2).trim();
				} else {
					value = templateText.substring(equalSignIndex+1, pipeSignIndex).trim();
				}
				
				obj[key] = value;
				currIndex = pipeSignIndex + 1;
			}
		}
		this.templateData = obj;
		
		return obj;
	}
	
	function findTamplateText(templateName = this._templateName, 
							  articleContent=this._articleContent) {
		var startStr = `{{${templateName}`;
		var templateText = '';
		var startIndex = articleContent.indexOf(startStr);
		if (startIndex > -1) {
			var endIndex = WikiParser.nextWikiText(articleContent,startIndex+ startStr.length, '}}') + 2;
			templateText = articleContent.substring(startIndex,endIndex);
		}
		return templateText;
	}
})();


var WikiParser = (function(){
	'use strict';
	const nowiki = '<nowiki>';
	const nowikiEnd = '</nowiki>';
	
	return {
		noWikiEndTagIndex,
		nextWikiText,
		buildTableRow
	};
	
	function noWikiEndTagIndex(text, startIndex) {
		return text.indexOf(nowikiEnd,startIndex) + nowikiEnd.length;
	}
	
	function nextWikiText(text, currIndex, str) {
		while(text.substr(currIndex,str.length) !== str && currIndex < text.length) {
			if (text.substr(currIndex,nowiki.length) === nowiki) {
				currIndex = getNoWikiEndIndex(text, currIndex);
			} else if (text.substr(currIndex,2) === '{{') {
				currIndex = nextWikiText(text,currIndex+2, '}}') + 2;
			} else if (text[currIndex] === '{') {
				currIndex = nextWikiText(text,currIndex+1, '}') + 1;
			} else if (text[currIndex] === '[') {
				currIndex = nextWikiText(text,currIndex+1, ']') + 1;
			} else {
				currIndex++;
			}
		}
		currIndex = currIndex < text.length ? currIndex : -1;
		
		return currIndex;
	}
	
	function buildTableRow(fields, style, isHeader) {
		var delimiter = isHeader ? '!' : '|';
		style = style ? (style + delimiter) : '';
		var rowStr = `\n|-\n${delimiter}${style}[[${fields[0]}]]`;
		for	(let i = 1; i < (fields.length); i++) {
			rowStr += ' || ' + (fields[i] === undefined ? '---' : fields[i]);
		}
		return rowStr;
	}
})();
var WikiUpdater = (()=> {
	'use strict';
	let _token;
	
	chrome.storage.local.get('revisionData', (res) => {
		if (!res.revisionData) {
			chrome.storage.local.set({revisionData:{}});
		}
	});
	
	
	fetch('https://he.wikipedia.org/w/api.php?action=query&meta=tokens&format=json&assert=bot',{
		credentials: 'include'
	})
	.then(res=> res.json())
	.then(res=> _token = res.query.tokens.csrftoken);
	
	class WikiUpdater {
		constructor() {
			this._edits = [];	
		}
		
		editSection(articleTitle, sectionTitle,sectionId, content) {
			var fetchDetails = {
				method : 'post',
				body:InfraStructure.objectToFormData({title:articleTitle,section:sectionId,text:content,token:_token,summary:sectionTitle}),
				credentials: 'include'
			};
			fetch('https://he.wikipedia.org/w/api.php?action=edit&format=json&assert=bot&bot=true',fetchDetails)
			.then(res=> res.json())
			.then(res=> {
					_that._edits.push({revisionId:res.edit.newrevid, title: articleTitle});
					this.saveEdits();
				});
		}
		
		updateArticle(articleTitle, summary, content) {
			var _that = this;
			var fetchDetails = {
				method : 'post',
				body:InfraStructure.objectToFormData({title:articleTitle,text:content,token:_token,summary:summary}),
				credentials: 'include' 
			};
			fetch('https://he.wikipedia.org/w/api.php?action=edit&format=json&assert=bot&bot=true',fetchDetails)
				.then(res=> res.json())
				.then(res=> {
					_that._edits.push({revisionId:res.edit.newrevid, title: articleTitle});
					this.saveEdits();
				});
		}
		rollbackAllEdits(summary) {
			for	(let edit of this._edits) {
				this.rollbackEdit(edit.title, summary, edit.revisionId);
			}
			this._edits  = [];
		}
		rollbackEdit(articleTitle, summary, revisionId) {
			var _that = this;
			var fetchDetails = {
				method : 'post',
				body:InfraStructure.objectToFormData({title:articleTitle,undo:revisionId,token:_token}),
				credentials: 'include' 
			};
			fetch('https://he.wikipedia.org/w/api.php?action=edit&format=json&assert=bot&bot=1',fetchDetails)
				.then(res=> res.json())
				.then(res=> console.log(res));
		}
		saveEdits(){
			var _that = this;
			chrome.storage.local.get('revisionData', (res) => {
				for (let edit of _that._edits) {
					res.revisionData[edit.revisionId] = edit.title;
				}
				chrome.storage.local.set({revisionData:res.revisionData});
			});
		}
		
		rollbackAllStorageEdits(summery) {
			chrome.storage.local.get('revisionData', (res) => {
				for	(let revId in res.revisionData) {
					rollbackEdit(res.revisionData[revId], summery, revId);
				}
			});
			
			chrome.storage.local.set({revisionData:{}});
		}
	}
	
	return WikiUpdater;
})();

var WikiTableParser = (function(){
	WikiTableParser.prototype.findTablesText = findTablesText;
	return WikiTableParser;
	function WikiTableParser(articleText) {
		this._articleContent = articleText;
		var tableTexts = this.findTablesText();
		
		this.tables = tableTexts
			.map(tableTextToObject);
	}
	
	function tableTextToObject(tableText) {
		var startStr = '{|';
		var tableData = {text: tableText, rows:[]};
		
		var headerIndex = tableText.indexOf('!', startStr.length);
		var rowIndex = tableText.indexOf('|',startStr.length);
		var hasHeader = (headerIndex > -1) && (headerIndex < rowIndex);
		var currIndex = hasHeader ? headerIndex : rowIndex;
		tableData.tableStyle = tableText.substring(startStr.length,currIndex).trim();
		var nextRowIndex = WikiParser.nextWikiText(tableText, currIndex, '|-');
		
		if (hasHeader) {
			var rowText = tableText.substring(currIndex+1,nextRowIndex).trim();
			tableData.rows.push(getTableRow(rowText, true));
			currIndex = nextRowIndex += 2;
			nextRowIndex = WikiParser.nextWikiText(tableText, currIndex, '|-');
		}
		
		while (nextRowIndex > -1) {
			var rowText = tableText.substring(currIndex+1,nextRowIndex).trim();
			tableData.rows.push(getTableRow(rowText, false));
			currIndex = nextRowIndex += 2;
			nextRowIndex = WikiParser.nextWikiText(tableText, currIndex, '|-');
		}
		
		var rowText = tableText.substr(currIndex+1).trim();
		tableData.rows.push(getTableRow(rowText, false));
		
		return tableData;
	}
	
	function getTableRow(rowText, isHeader){
		var delimiter = isHeader ? '!' : '|';
		var row = {values:[]};
		var currIndex = 0;
		
		if (rowText[currIndex] === delimiter) {
			currIndex++;
		}
		
		var nextDelimiterIndex = 
			WikiParser.nextWikiText(rowText, currIndex, delimiter);
		
		// Row has style cell
		if (rowText[nextDelimiterIndex + 1] !== delimiter) {
			row.rowStyle = rowText.substring(currIndex, nextDelimiterIndex).trim();
			currIndex = nextDelimiterIndex + 1;
		}
		
		nextDelimiterIndex = getNextRowDelimiterIndex(rowText, currIndex, delimiter);
		
		while (nextDelimiterIndex !== -1) {
			row.values.push(rowText.substring(currIndex, nextDelimiterIndex).trim());
			currIndex = nextDelimiterIndex + 2;
			nextDelimiterIndex = getNextRowDelimiterIndex(rowText, currIndex, delimiter);
		}
		
		row.values.push(rowText.substr(currIndex).trim());
		
		return row;
	}
	
	function getNextRowDelimiterIndex(rowText, currIndex, delimiter){
		var nextDelimiterIndex1 = 
			WikiParser.nextWikiText(rowText, currIndex, delimiter + delimiter);
		var nextDelimiterIndex2 = 
			WikiParser.nextWikiText(rowText, currIndex, '\n' + delimiter);
		var index = ((nextDelimiterIndex2 === -1) || ((nextDelimiterIndex1 < nextDelimiterIndex2) && (nextDelimiterIndex1 > -1))) ? 
				nextDelimiterIndex1 : 
				nextDelimiterIndex2;
		return index;
	}
	
	function findTablesText(articleContent=this._articleContent) {
		var startStr = '{|';
		var tables = [];
		
		var startIndex = articleContent.indexOf(startStr);
		
		while (startIndex > -1) {
			var endIndex = WikiParser.nextWikiText(articleContent,startIndex+ startStr.length, '|}') + 2;
			tables.push(articleContent.substring(startIndex,endIndex));
			startIndex = articleContent.indexOf(startStr, endIndex);
		}
		return tables;
	}
})();

class WikiAPI {
	static contentOfPage(title, callback){
		fetch(`https://he.wikipedia.org/w/api.php?action=query&format=json&prop=revisions&rvprop=content&titles=${title}`)
			.then(res=>res.json())
			.then(res=>{
				var pageId = Object.keys(res.query.pages)[0];
				callback(res.query.pages[pageId].revisions[0]['*']);
			});
	}
	static getLangLinkName(name, srcLng, destLang, callback){
		fetch('https://'+srcLng+'.wikipedia.org/w/api.php?action=query&prop=langlinks&titles=' + name + '&redirects=&lllang='+destLang+'&format=json')
		.then(res=>res.json())
		.then(res => {
			var pages = res.query.pages;
			var page = pages[Object.keys(pages)[0]];
			if (page.langlinks){
				callback(page.langlinks[0]['*']);
			} else {
				callback();
			}
		});
	}
}

class InfraStructure {
	static objectToFormData(obj){
		let fd = new FormData();
		for (let k in obj ) {
			fd.append(k,obj[k]);
		}
		return fd;
	}
}