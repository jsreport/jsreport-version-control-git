const Promise = require('bluebird')
const JsReport = require('jsreport-core')
const path = require('path')
const rimraf = Promise.promisify(require('rimraf'))
const commonTests = require('jsreport-version-control').tests()

describe('git versioning', () => {
  let jsreport

  beforeEach(async () => {
    await rimraf(path.join(__dirname, 'tmpData'))
    jsreport = JsReport({ connectionString: { name: 'fs' }, versionControl: { name: 'git' } })
    jsreport.use(require('jsreport-templates')())
    jsreport.use(require('jsreport-data')())
    jsreport.use(require('jsreport-phantom-pdf')())
    jsreport.use(require('jsreport-version-control')())
    jsreport.use(require('jsreport-assets')())
    jsreport.use(require('jsreport-fs-store')({
      dataDirectory: path.join(__dirname, 'tmpData')
    }))
    jsreport.use(require('../')())
    return jsreport.init()
  })

  commonTests(() => jsreport, () => jsreport.documentStore.provider.init())
})
