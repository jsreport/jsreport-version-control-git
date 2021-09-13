const Promise = require('bluebird')
const fs = require('fs')
const fsExtra = require('fs-extra')
const JsReport = require('jsreport-core')
const path = require('path')
const rimraf = Promise.promisify(require('rimraf'))
const commonTests = require('jsreport-version-control').tests()
const git = require('nodegit')
const assert = require('assert').strict

describe('git versioning', () => {
  let jsreport
  const tmpData = path.join(__dirname, 'tmpData')

  async function initJsreport (options) {
    await rimraf(tmpData)

    jsreport = JsReport(options)
    jsreport.use(require('jsreport-templates')())
    jsreport.use(require('jsreport-data')())
    jsreport.use(require('jsreport-chrome-pdf')())
    jsreport.use(require('jsreport-version-control')())
    jsreport.use(require('jsreport-assets')())
    jsreport.use(require('jsreport-fs-store')({
      dataDirectory: tmpData,
      syncModifications: false
    }))
    jsreport.use(require('../')())
    return jsreport.init()
  }

  afterEach(async () => {
    if (jsreport !== undefined) {
      await jsreport.close()
    }

    fsExtra.emptyDir(tmpData)
  })

  describe('common', () => {
    beforeEach(async () => {
      await initJsreport({ store: { provider: 'fs' }, versionControl: { provider: 'git' } })
    })
    commonTests(() => jsreport, async () => {
      return jsreport.documentStore.provider.load(jsreport.documentStore.model)
    })
  })

  it('should initialize an empty directory with local git', async () => {
    await initJsreport({ store: { provider: 'fs' }, versionControl: { provider: 'git' } })

    fs.existsSync(path.join(tmpData, '.git')).should.be.true()
  })

  it('should initialize a non-empty directory with local git', async () => {
    fs.writeFileSync(path.join(tmpData, 'new-file.txt'), 'This is a new file')

    await initJsreport({ store: { provider: 'fs' }, versionControl: { provider: 'git' } })

    const repo = await git.Repository.open(tmpData)

    assert.ok(repo instanceof git.Repository)
  })

  it('should clone the remote repository with an empty directory', async () => {
    await jsreport.documentStore.collection('templates').insert({ content: 'foo', name: 'foo', engine: 'none', recipe: 'html' })

    await initJsreport({ store: { provider: 'fs' }, versionControl: { provider: 'git', remote: { url: 'http://localhost:8174/templates.git', branch: 'master', allowPush: true } } })
    const repo = await git.Repository.open(tmpData)
    const remote = await repo.getRemoteNames()

    assert.ok(repo instanceof git.Repository)
    assert.ok(remote.length > 0)
  })

  it('should clone the remote repository and copy files over in a non-empty directory', async () => {
    await jsreport.documentStore.collection('templates').insert({ content: 'foo', name: 'foo', engine: 'none', recipe: 'html' })

    await initJsreport({ store: { provider: 'fs' }, versionControl: { provider: 'git', remote: { url: 'http://localhost:8174/templates.git', branch: 'master', allowPush: true } } })

    const repo = await git.Repository.open(tmpData)
    const remote = await repo.getRemoteNames()

    assert.ok(repo instanceof git.Repository)
    assert.ok(remote.length > 0)
    fs.existsSync(path.join(jsreport.options.extensions['fs-store'].dataDirectory, 'foo'))
  })
})
