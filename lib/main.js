const VC = require('./gitVC')

module.exports = (reporter, definition) => {
  if (!reporter.versionControl) {
    throw new Error(`jsreport-version-control-git needs jsreport-version-control to be installed`)
  }

  reporter.versionControl.registerProvider(VC(reporter))
}
