const VC = require('./gitVC')

module.exports = (reporter, definition) => {
  if (!reporter.versionControl) {
    throw new Error('jsreport-version-control-git needs jsreport-version-control to be installed')
  }

  if (reporter.documentStore.provider.name !== 'fs') {
    throw new Error('jsreport-version-control-git needs jsreport-fs-store to be configured as store')
  }

  const remote = Object.assign({}, reporter.options.versionControl, reporter.options.extensions.versionControl)

  const options = {
    remote: remote.remote.url,
    branch: remote.remote.branch
  }

  if (options.remote && !(options.remote.startsWith('https://') || options.remote.startsWith('git@'))) {
    throw new Error('If specified, jsreport-version-control-git requires a valid git repository url')
  }

  reporter.documentStore.on('after-init', () => {
    // we need after-init because we need to get dataDirectory from fs-store
    options.dataDirectory = reporter.documentStore.provider.dataDirectory
    reporter.versionControl.registerProvider('git', VC(reporter, options))
  })

  reporter.initializeListeners.add(definition.name, () => {
    if (reporter.express) {
      reporter.express.exposeOptionsToApi(definition.name, {
        remote: remote.url
      })
    }
  })

  reporter.on('express-configure', (app) => {
    app.set('gitProvider', VC(reporter, options))
    app.use('/api/version-control-git', (req, res, next) => {
      if (reporter.authentication) {
        if (req.context && req.context.user && req.context.user.isAdmin) {
          next()
        } else {
          next(reporter.createError('version control is only available for admin user', {
            statusCode: 401
          }))
        }
      } else {
        next()
      }
    })

    app.get('/api/version-control-git/local-commits', (req, res, next) => {
      req.app.get('gitProvider').localCommits(req)
        .then((d) => res.send(d))
        .catch(next)
    })

    app.post('/api/version-control-git/push', (req, res, next) => {
      if (!remote.allowPush) {
        next(reporter.createError('Push not permitted. Set "allowPush" to true in the version control extension settings to allow.', {
          statusCode: 401
        }))
      }

      req.app.get('gitProvider').pushChanges()
        .then((d) => res.send({ status: 1 }))
        .catch(next)
    })

    app.get('/api/version-control-git/status', (req, res, next) => {
      req.app.get('gitProvider').localChangesFromRemote()
        .then((d) => res.send(d))
        .catch(next)
    })

    app.get('/api/version-control-git/merge', (req, res, next) => {
      req.app.get('gitProvider').performMerge()
        .then((d) => res.send({ status: 1 }))
        .catch(next)
    })
  })
}
