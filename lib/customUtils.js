const git = require('nodegit')
const fsExtra = require('fs-extra')
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

  repoClone: async function (gitUrl, cloneDir) {
    await fsExtra.emptyDir(cloneDir)
    var authAttempted = false
    await git.Clone.clone(gitUrl, cloneDir, {
      fetchOpts: {
        callbacks: {
          certificateCheck: () => 1,
          credentials: (url, username) => this.getCredentials(url, username, authAttempted)
        }
      }
    })
  },

  walkUpTree: async function (start, dest) {
    while (start !== '.') {
      const files = await fsExtra.readdir(start)

      if (files.includes(dest)) {
        return path.join(start, dest)
      }

      start = path.dirname(start)
    }
  }
}
