const VC = require('./gitVC')

module.exports = (reporter, definition) => {
  if (!reporter.versionControl) {
    throw new Error(`jsreport-version-control-git needs jsreport-version-control to be installed`)
  }

  if (reporter.documentStore.provider.name !== 'fs') {
    throw new Error(`jsreport-version-control-git needs jsreport-fs-store to be configured as store`)
  }

  reporter.documentStore.on('after-init', () => {
    // we need after-init because we need to get dataDirectory from fs-store
    reporter.versionControl.registerProvider('git', VC(reporter))
  })
}
