const Promise = require('bluebird')
const JsReport = require('jsreport-core')
const path = require('path')
const rimraf = Promise.promisify(require('rimraf'))
const commonTests = require('jsreport-version-control').tests()

describe('git versioning', () => {
  let jsreport

  beforeEach(async () => {
    await rimraf(path.join(__dirname, 'tmpData'))

    jsreport = JsReport({ store: { provider: 'fs' }, versionControl: { provider: 'git' } })
    jsreport.use(require('jsreport-templates')())
    jsreport.use(require('jsreport-data')())
    jsreport.use(require('jsreport-chrome-pdf')())
    jsreport.use(require('jsreport-version-control')())
    jsreport.use(require('jsreport-assets')())
    jsreport.use(require('jsreport-fs-store')({
      dataDirectory: path.join(__dirname, 'tmpData'),
      syncModifications: false
    }))
    jsreport.use(require('../')())
    return jsreport.init()
  })

  afterEach(async () => {
    if (jsreport) {
      await jsreport.close()
    }
  })

  commonTests(() => jsreport, () => {
    return jsreport.documentStore.provider.load(jsreport.documentStore.model)
  })
})
