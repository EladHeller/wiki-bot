/*
var tradeTemplateBoot = new TradeTemplateBoot(2015);
tradeTemplateBoot.run();
---
var tableFormatData = tradeTemplateBoot.tableFormat();
TradeTemplateBoot.wikiUpdater.updateArticle('משתמש:Sapper-bot/tradeBootData','עדכון',tableFormatData);
---
var companies = tradeTemplateBoot.getRelevantCompanies();
companies.forEach(company => company.updateCompanyArticle());
---
var nc = companies.filter(x=>x.newArticleText.indexOf('== הערות שוליים ==') === -1 && x.newArticleText.indexOf('==הערות שוליים==') === -1)
*/

var TradeTemplateBoot = (function(){
	'use strict';
	const mayaLinkRegex = /^http:\/\/maya\.tase\.co\.il\/company\/(\d*)\?view=reports$/;
	const jsonLink ='http://mayaapi.tase.co.il/api/company/financereports?companyId=';
	const companyPageLink ='http://maya.tase.co.il/company/'
	const companyReportView  ='?view=reports';
	const companyFinanceView  ='?view=finance';
	const mayaGetOptions = {
		method : 'get',
		credentials: 'include',
		headers: new Headers({
			'X-Maya-With':'allow'
		})
	};
	let mayaOptionsOptions = {
		method : 'options',
		credentials: 'include',
	};
	TradeTemplateBoot.wikiUpdater = new WikiUpdater();
	TradeTemplateBoot.prototype.run = run;
	TradeTemplateBoot.prototype.getRelevantCompanies = getRelevantCompanies;
	TradeTemplateBoot.prototype.tableFormat = tableFormat;
	return TradeTemplateBoot;
	
	function TradeTemplateBoot(year) {
		if (!year) {
			throw new Exception('year parameter is required');
		}
		this.year = year;
		this.companies = [];
	}

	function run(continueParam){
		if (!continueParam) {
			this._getPages = 0;
			this._exceptPages = 0;
		}
		var geicontinue = continueParam ? ('&geicontinue=' + continueParam) : '';
		var _that = this;
		fetch("https://he.wikipedia.org/w/api.php?action=query&format=json" + 
			  // Pages with תבנית:מידע בורסאי
			  "&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=תבנית:מידע בורסאי" + geicontinue +
			  "&prop=templates|revisions|extlinks"+
			  // This page contains תבנית:חברה מסחרית?
			  "&tltemplates=תבנית:חברה מסחרית&tllimit=5000"+
			  // Get content of page
			  "&rvprop=content" +
			  // Get maya link
			  "&elprotocol=http&elquery=maya.tase.co.il/company/&ellimit=5000",{
				credentials: 'include'
			  })
			.then(res => res.json())
			.then(res => onListLoad.call(_that,res));
	}
	
	function onListLoad(res){
		if (res.continue) {
			this.run(res.continue.geicontinue);
		}
		
		var pages = res.query.pages;
		this._exceptPages += Object.keys(pages).length;
		var _that = this;
		var extLink;

		for (let companyId in pages) {
			let company = pages[companyId];
			extLink = company.extlinks.find(link=>link['*'].match(mayaLinkRegex))['*'];
			let companyFinnaceDetailsUrl =
				extLink.replace(companyPageLink,jsonLink).replace(companyReportView,'');
						 
			fetch(companyFinnaceDetailsUrl,mayaOptionsOptions)
				.then((res)=>fetch(companyFinnaceDetailsUrl,mayaGetOptions))
				.then((res)=>res.json())
				.then(jsonRes=> {
					companyDetailsCallback.call(this,company,jsonRes)
				})
			.catch(e=> {
				this._getPages++;
				console.error(e);
				if (this._getPages === this._exceptPages) {
					console.log('finnish!');
				}
			});
		}
	}

	function companyDetailsCallback(company,res) {
		var mayaDetails = new Map();
		for (let row of res.AllRows) {
			mayaDetails.set(row.Name, row.CurrPeriodValue);
		}
		
		var companyObj = new Company(company.title,mayaDetails,company, res.CurrentPeriod.Year);
		this.companies.push(companyObj);
		this._getPages++;
		
		if (this._getPages === this._exceptPages) {
			console.log('finnish!');
		}
	}
	
	function tableFormat() {
		var tableRows = '';
		var details;
		
		for (let company of this.companies) {
			details = [company.name];
			for (let field in company.mayaDataForWiki) {
				details.push(company.wikiTemplateData[field] || '---');
			}
			details.push(company.wikiTemplateData.year);
			details.push(company.isContainsTamplate);
			tableRows += WikiParser.buildTableRow(details);
		}
		
		return `{| class="wikitable sortable"\n! שם החברה !! הכנסות !! רווח תפעולי !! רווח!!תאריך הנתונים!!מכיל [[תבנית:חברה מסחרית]]${tableRows}\n|}`;
	}
	
	function getRelevantCompanies() {
		var _that = this;
		return this.companies.filter(function (company) {
			return company.newArticleText && 
				(company.wikiTemplateData.year === _that.year) &&
				company.hasData &&
				company.newArticleText !== company.articleText;
		});
	}
})();

var Company = (function(){
	'use strict';
	const TEMPLATE_NAME ='חברה מסחרית';
	const lossStr = 'הפסד של';
	const thousandStr = '1000 (מספר)|אלף';
	const millionStr = 'מיליון';
	const milliardStr = 'מיליארד';
	const NIS = 'ש"ח';
	const fieldsForWiki = [
		{mayaName:'סה"כ הכנסות',wikiName:'הכנסה'}, 
		{mayaName:'רווח תפעולי',wikiName:'רווח תפעולי'}, 
		{mayaName:'רווח נקי',wikiName:'רווח'}
	];
	const NAME_FIELD = 'שם';
	const NAME_STRING = '{{שם הדף בלי הסוגריים}}';
	const companyReportView  ='?view=reports';
	const companyFinanceView  ='?view=finance';
	Company.wikiUpdater = new WikiUpdater();
	Company.prototype.updateWikiTamplate = updateWikiTamplate;
	Company.prototype.appendMayaData = appendMayaData;
	Company.prototype.appendWikiData = appendWikiData;
	Company.prototype.updateCompanyArticle = updateCompanyArticle;
	return Company;
	
	function Company(name, mayaData, wikiData, year) {
		this.name = name;
		
		if (mayaData) {
			this.appendMayaData(mayaData, year);
		}
		if (wikiData) {
			this.appendWikiData(wikiData);
		}
		this.updateWikiTamplate();
	}
	
	function updateCompanyArticle() {
		Company.wikiUpdater.updateArticle(this.name, 'עדכון תבנית:חברה מסחרית', this.newArticleText);
	}
	
	function updateWikiTamplate() {
		var isFirst = true;

		for	(let field of fieldsForWiki) {
			this.wikiTemplateData[field.wikiName] = 
				getFieldString(this.mayaDataForWiki[field.wikiName], 
							   this.wikiTemplateData.year,
							   this.reference,
							   this.templateParser.templateData[NAME_FIELD] || NAME_STRING,
							   isFirst);
			isFirst = false;
		
			this.templateParser.templateData[field.wikiName] = 
				this.wikiTemplateData[field.wikiName];
		}
	
		
		var oldTemplate = this.templateParser.templateText;
		this.templateParser.updateTamplateFromData();
		if (this.isContainsTamplate) {
			this.newArticleText = this.articleText.replace(oldTemplate, this.templateParser.templateText);
		// If not contains template and not has other template
		} else if (!this.articleText.trim().startsWith('{')){
			this.newArticleText = this.templateParser.templateText + '\n' + this.articleText;
		}
	}
	
	function appendWikiData(wikiData) {
		this.isContainsTamplate = 'templates' in wikiData;
		this.articleText = wikiData.revisions[0]['*'];
		this.reference = wikiData.extlinks[0]['*'];
		this.templateParser = new WikiTemplateParser(this.articleText, TEMPLATE_NAME);			
	}
	
	function appendMayaData(mayaData, year) {
		this.mayaDataForWiki = {};
		this.wikiTemplateData = {};
		this.hasData = false;
		
		for	(let field of fieldsForWiki) {
			var fieldData = mayaData.get(field.mayaName);
			this.hasData = this.hasData || !!fieldData;
			this.mayaDataForWiki[field.wikiName] = mayaData.get(field.mayaName);
		}

		this.wikiTemplateData.year = year;
	}
	
	function getFieldString(fieldData, year, reference, name, isFirst) {
		var finalString = '';
		if (fieldData) {
			fieldData = fieldData.trim().replace(/,/g,'');
			
			if (fieldData.startsWith('-')) {
				finalString += lossStr + ' ';
				fieldData = fieldData.substr(1);
			}
			
			var order;
			var sumStr;
			if (fieldData.length < 4) {
				order = thousandStr;
				sumStr = fieldData;
			} else if (fieldData.length < 10) {
				order = fieldData.length < 7 ? millionStr : milliardStr;
				sumStr = fieldData.substring(0,3);
				var remind = fieldData.length % 3;
				if (remind) {
					sumStr = [sumStr.slice(0, remind), '.', sumStr.slice(remind)].join('');
				}
			} else {
				order = milliardStr;
				sumStr = Number(fieldData.substring(0,fieldData.length - 6)).toLocaleString();
			}
			var commentKey = `דוח${year}-${name}`;
			var comment = `{{הערה|שם=${commentKey}${isFirst ? `|1=${name}: [${reference.replace(companyReportView,companyFinanceView)} נתונים כספיים] באתר [[מאי"ה]].` :''}}}`;
			finalString += `${sumStr} [[${order}]] [[${NIS}]] ([[${year}]])${comment}`;
		}
		
		return finalString;
	}
})();