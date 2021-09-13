const git = require('nodegit')
const fsExtra = require('fs-extra')
const fs = require('fs')
const { URL } = require('url')
const path = require('path')

module.exports = {
  getOperationFromPatch: function (patch) {
    if (patch.isAdded()) {
      return 'insert'
    }

    if (patch.isDeleted()) {
      return 'remove'
    }

    return 'update'
  },

  patchToDiffString: async function (patch) {
    const diffList = []

    diffList.push('Index: ' + patch.newFile().path())

    diffList.push('===================================================================')
    diffList.push('--- ' + patch.newFile().path())
    diffList.push('+++ ' + patch.newFile().path())

    const hunks = await patch.hunks()
    for (const hunk of hunks) {
      diffList.push(
        '@@ -' + hunk.oldStart() + ',' + hunk.oldLines() +
              ' +' + hunk.newStart() + ',' + hunk.newLines() +
              ' @@'
      )
      const lines = await hunk.lines()
      diffList.push.apply(diffList, lines.map((l) => String.fromCharCode(l.origin()) + l.content().trim()))
    }

    return diffList.join('\n') + '\n'
  },

  diffToChanges: async function (diff) {
    const patches = await diff.patches()
    const result = []
    for (const patch of patches) {
      const filePath = patch.newFile().path()

      result.push({
        path: `/${filePath}`,
        entitySet: filePath.split('/')[0],
        operation: this.getOperationFromPatch(patch),
        patch: await this.patchToDiffString(patch)
      })
    }

    return result
  },

  getCredentials: async function (url, username, authAttempted) {
    if (authAttempted) return git.Cred.defaultNew()
    authAttempted = true
    if (url.startsWith('https://') && url.includes('@')) {
      url = new URL(url)
      return git.Cred.userpassPlaintextNew(url.username, url.password)
    } else {
      return git.Cred.sshKeyFromAgent(username)
    }
  },

  repoClone: async function (gitUrl, cloneDir, branch) {
    await fsExtra.emptyDir('/tmp/local')
    await fsExtra.emptyDir('/tmp/data')
    const empty = await this.isDirEmpty(cloneDir)

    if (!empty) {
      await fsExtra.copy(cloneDir, '/tmp/local')
    }

    var authAttempted = false

    await git.Clone.clone(gitUrl, '/tmp/data', {
      checkoutBranch: branch,
      fetchOpts: {
        callbacks: {
          certificateCheck: () => 1,
          credentials: (url, username) => this.getCredentials(url, username, authAttempted)
        }
      }
    })

    await fsExtra.emptyDir(cloneDir)
    await fsExtra.copy('/tmp/data', cloneDir)

    if (!empty) {
      const files = await fs.promises.readdir('/tmp/local')

      await Promise.all(files.map(async (file) => {
        var fromPath = path.join('/tmp/local', file)
        var toPath = path.join(cloneDir, file)

        await fsExtra.copy(fromPath, toPath)
      }))

      await fsExtra.emptyDir('/tmp/local')
      fs.rmdirSync('/tmp/local')
    }

    await fsExtra.emptyDir('/tmp/data')
    fs.rmdirSync('/tmp/data')
  },

  walkUpTree: async function (start, dest) {
    while (start !== '.') {
      const files = await fsExtra.readdir(start)

      if (files.includes(dest)) {
        return path.join(start, dest)
      }

      start = path.dirname(start)
    }
  },

  isDirEmpty: async function (dirname) {
    const files = await fs.promises.readdir(dirname)

    return files.length === 0
  },

  hasRemoteAsOrigin: async function (gitDir, remoteUrl) {
    const repo = await git.Repository.open(gitDir)
    const remote = await repo.getRemote('origin')

    return remote.url() === remoteUrl
  }
}
