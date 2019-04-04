/*
const tradeTemplateBoot = new TradeTemplateBoot(2018)
tradeTemplateBoot.run()
---
const tableFormatData = tradeTemplateBoot.tableFormat()
TradeTemplateBoot.wikiUpdater.updateArticle('משתמש:Sapper-bot/tradeBootData','עדכון',tableFormatData)
---
const companies = tradeTemplateBoot.getRelevantCompanies()
companies.forEach(company => company.updateCompanyArticle())
---
const nc = companies.filter(x =>
x.newArticleText.indexOf('== הערות שוליים ==') === -1 && x.newArticleText.indexOf('==הערות שוליים==') === -1)
*/
/* eslint-disable no-use-before-define */
// eslint-disable-next-line
const TradeTemplateBoot = (() => {
  const mayaLinkRegex = /^http:\/\/maya\.tase\.co\.il\/company\/(\d*)\?view=reports$/
  const jsonLink = 'http://mayaapi.tase.co.il/api/company/financereports?companyId='
  const companyPageLink = 'http://maya.tase.co.il/company/'
  const companyReportView = '?view=reports'
  const mayaGetOptions = {
    method: 'get',
    credentials: 'include',
    headers: new Headers({
      'X-Maya-With': 'allow',
    }),
  }
  const mayaOptionsOptions = {
    method: 'options',
    credentials: 'include',
  }
  TradeTemplateBoot.wikiUpdater = new WikiUpdater()
  TradeTemplateBoot.prototype.run = run
  TradeTemplateBoot.prototype.getRelevantCompanies = getRelevantCompanies
  TradeTemplateBoot.prototype.tableFormat = tableFormat
  return TradeTemplateBoot

  function TradeTemplateBoot(year) {
    if (!year) {
      throw new Exception('year parameter is required')
    }
    this.year = year
    this.companies = []
  }

  function run(continueParam) {
    if (!continueParam) {
      this._getPages = 0
      this._exceptPages = 0
    }
    const geicontinue = continueParam ? (`&geicontinue=${continueParam}`) : ''
    const that = this
    fetch(`${'https://he.wikipedia.org/w/api.php?action=query&format=json' +
      // Pages with תבנית:מידע בורסאי
      '&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=תבנית:מידע בורסאי'}${geicontinue
    }&prop=templates|revisions|extlinks` +
      // This page contains תבנית:חברה מסחרית?
      '&tltemplates=תבנית:חברה מסחרית&tllimit=5000' +
      // Get content of page
      '&rvprop=content' +
      // Get maya link
      '&elprotocol=http&elquery=maya.tase.co.il/company/&ellimit=5000', {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(res => onListLoad.call(that, res))
  }

  function onListLoad(res) {
    if (res.continue) {
      this.run(res.continue.geicontinue)
    }

    const {pages} = res.query
    this._exceptPages += Object.keys(pages).length
    let extLink
    pages.keys().forEach((companyId) => {
      const company = pages[companyId]
      extLink = company.extlinks.find(link => link['*'].match(mayaLinkRegex))['*']
      const companyFinnaceDetailsUrl = extLink.replace(companyPageLink, jsonLink).replace(companyReportView, '')

      fetch(companyFinnaceDetailsUrl, mayaOptionsOptions)
        .then(() => fetch(companyFinnaceDetailsUrl, mayaGetOptions))
        .then(result => result.json())
        .then((jsonRes) => {
          companyDetailsCallback.call(this, company, jsonRes)
        })
        .catch((e) => {
          this._getPages++
          console.error(company, e)
          if (this._getPages === this._exceptPages) {
            console.log('finnish!')
          }
        })
    })
  }

  function companyDetailsCallback(company, res) {
    const mayaDetails = new Map()
    res.AllRows.forEach((row) => {
      mayaDetails.set(row.Name, row.CurrPeriodValue)
    })

    const companyObj = new Company(company.title, mayaDetails, company, res.CurrentPeriod.Year)
    this.companies.push(companyObj)
    this._getPages++

    if (this._getPages === this._exceptPages) {
      console.log('finnish!')
    }
  }

  function tableFormat() {
    let tableRows = ''
    let details
    this.companies.forEach((company) => {
      details = [company.name]
      company.mayaDataForWiki.values().forEach((val) => {
        details.push(val || '---')
      })
      details.push(company.wikiTemplateData.year)
      details.push(company.isContainsTamplate)
      tableRows += WikiParser.buildTableRow(details)
    })

    return `{| class="wikitable sortable"\n! שם החברה !! הכנסות !! רווח תפעולי !! רווח!!תאריך הנתונים!!מכיל [[תבנית:חברה מסחרית]]${tableRows}\n|}`
  }

  function getRelevantCompanies() {
    const that = this
    return this.companies.filter(company => company.newArticleText &&
      (company.wikiTemplateData.year === that.year) &&
      company.hasData &&
      company.newArticleText !== company.articleText)
  }
})()

const Company = (function companyClass() {
  const TEMPLATE_NAME = 'חברה מסחרית'
  const lossStr = 'הפסד של'
  const thousandStr = '1000 (מספר)|אלף'
  const millionStr = 'מיליון'
  const milliardStr = 'מיליארד'
  const NIS = 'ש"ח'
  const fieldsForWiki = [
    {mayaName: 'סה"כ הכנסות', wikiName: 'הכנסה'},
    {mayaName: 'רווח תפעולי', wikiName: 'רווח תפעולי'},
    {mayaName: 'רווח נקי', wikiName: 'רווח'},
    {mayaName: 'הון עצמי', wikiName: 'הון עצמי'},
    {mayaName: 'סך מאזן', wikiName: 'סך המאזן'},
  ]
  const NAME_FIELD = 'שם'
  const NAME_STRING = '{{שם הדף בלי הסוגריים}}'
  const companyReportView = '?view=reports'
  const companyFinanceView = '?view=finance'
  Company.wikiUpdater = new WikiUpdater()
  Company.prototype.updateWikiTamplate = updateWikiTamplate
  Company.prototype.appendMayaData = appendMayaData
  Company.prototype.appendWikiData = appendWikiData
  Company.prototype.updateCompanyArticle = updateCompanyArticle
  return Company

  function Company(name, mayaData, wikiData, year) {
    this.name = name

    if (mayaData) {
      this.appendMayaData(mayaData, year)
    }
    if (wikiData) {
      this.appendWikiData(wikiData)
    }
    this.updateWikiTamplate()
  }

  function updateCompanyArticle() {
    Company.wikiUpdater.updateArticle(this.name, 'עדכון תבנית:חברה מסחרית', this.newArticleText)
  }

  function updateWikiTamplate() {
    let isFirst = true
    fieldsForWiki.forEach((field) => {
      this.wikiTemplateData[field.wikiName] =
      getFieldString(
        this.mayaDataForWiki[field.wikiName],
        this.wikiTemplateData.year,
        this.reference,
        this.templateParser.templateData[NAME_FIELD] || NAME_STRING,
        isFirst
      )
      isFirst = false

      this.templateParser.templateData[field.wikiName] = this.wikiTemplateData[field.wikiName]
    })


    const oldTemplate = this.templateParser.templateText
    this.templateParser.updateTamplateFromData()
    if (this.isContainsTamplate) {
      this.newArticleText = this.articleText.replace(oldTemplate, this.templateParser.templateText)
      // If not contains template and not has other template
    } else if (!this.articleText.trim().startsWith('{')) {
      this.newArticleText = `${this.templateParser.templateText}\n${this.articleText}`
    }
  }

  function appendWikiData(wikiData) {
    this.isContainsTamplate = 'templates' in wikiData
    this.articleText = wikiData.revisions[0]['*']
    this.reference = wikiData.extlinks[0]['*']
    this.templateParser = new WikiTemplateParser(this.articleText, TEMPLATE_NAME)
  }

  function appendMayaData(mayaData, year) {
    this.mayaDataForWiki = {}
    this.wikiTemplateData = {}
    this.hasData = false

    fieldsForWiki.forEach((field) => {
      const fieldData = mayaData.get(field.mayaName)
      this.hasData = this.hasData || !!fieldData
      this.mayaDataForWiki[field.wikiName] = mayaData.get(field.mayaName)
    })

    this.wikiTemplateData.year = year
  }

  function getFieldString(fieldData, year, reference, name, isFirst) {
    let finalString = ''
    if (fieldData) {
      fieldData = fieldData.trim().replace(/,/g, '')

      if (fieldData.startsWith('-')) {
        finalString += `${lossStr} `
        fieldData = fieldData.substr(1)
      }

      let order = ''
      let sumStr
      if (fieldData === '0') {
        sumStr = fieldData
      } else if (fieldData.length < 4) {
        order = thousandStr
        sumStr = fieldData
      } else if (fieldData.length < 10) {
        order = fieldData.length < 7 ? millionStr : milliardStr
        sumStr = fieldData.substring(0, 3)
        const remind = fieldData.length % 3
        if (remind) {
          sumStr = [sumStr.slice(0, remind), '.', sumStr.slice(remind)].join('')
        }
      } else {
        order = milliardStr
        sumStr = Number(fieldData.substring(0, fieldData.length - 6)).toLocaleString()
      }
      const commentKey = `דוח${year}-${name}`
      const comment = `{{הערה|שם=${commentKey}${isFirst ? `|1=${name}: [${reference.replace(companyReportView, companyFinanceView)} נתונים כספיים] באתר [[מאי"ה]].` : ''}}}`
      finalString += `${sumStr} ${order ? `[[${order}]]` : ''} [[${NIS}]] ([[${year}]])${comment}`
    }

    return finalString
  }
}())
