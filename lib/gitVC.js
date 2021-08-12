const git = require('nodegit')
const Promise = require('bluebird')
const fsExtra = require('fs-extra')
const fs = require('fs')
const path = require('path')
const { URL } = require('url')

module.exports = (reporter, definition) => {
  const dataDirectory = reporter.documentStore.provider.dataDirectory

  if (!dataDirectory) {
    throw new Error('jsreport-version-control-git needs dataDirectory to be defined')
  }

  function getOperationFromPatch (patch) {
    if (patch.isAdded()) {
      return 'insert'
    }

    if (patch.isDeleted()) {
      return 'remove'
    }

    return 'update'
  }

  async function patchToDiffString (patch) {
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
  }

  async function diffToChanges (diff) {
    const patches = await diff.patches()
    const result = []
    for (const patch of patches) {
      const filePath = patch.newFile().path()

      result.push({
        path: `/${filePath}`,
        entitySet: filePath.split('/')[0],
        operation: getOperationFromPatch(patch),
        patch: await patchToDiffString(patch)
      })
    }

    return result
  }

  async function getCredentials (url, username, authAttempted) {
    if (authAttempted) return git.Cred.defaultNew()
    authAttempted = true
    if (url.startsWith('https://') && url.includes('@')) {
      url = new URL(url)
      return git.Cred.userpassPlaintextNew(url.username, url.password)
    } else {
      return git.Cred.sshKeyFromAgent(username)
    }
  }

  async function repoClone (gitUrl, cloneDir) {
    await fsExtra.emptyDir(cloneDir)
    var authAttempted = false
    await git.Clone.clone(gitUrl, cloneDir, {
      fetchOpts: {
        callbacks: {
          certificateCheck: () => 1,
          credentials: (url, username) => getCredentials(url, username, authAttempted)
        }
      }
    })
  }

  return ({
    async init () {
      reporter.logger.debug('Version control for git is initializing repository')

      const remote = reporter.options.extensions.versionControl.remote

      if (remote) {
        reporter.logger.debug('Remote git repository given; cloning repository from remote')

        await repoClone(remote, 'tmp-data')
        fs.rename('tmp-data/.git', path.join(dataDirectory, '.git'), () => {})
        await fsExtra.emptyDir('tmp-data')

        return fs.rmdirSync('tmp-data')
      } else {
        reporter.logger.debug('No remote repository given; initializing new repository for local')
        await git.Repository.init(dataDirectory, 0)

        const repo = await git.Repository.open(dataDirectory)
        if ((await repo.isEmpty()) === 0) {
          return
        }

        reporter.logger.debug('Version control for git is making initial commit')
        const index = await repo.refreshIndex()
        await index.addAll()
        await index.write()
        const oid = await index.writeTree()
        const sig = await repo.defaultSignature()
        return repo.createCommit('HEAD', sig, sig, 'initial commit', oid)
      }
    },
    async commit (message) {
      const repo = await git.Repository.open(dataDirectory)
      const index = await repo.refreshIndex()
      await index.addAll()
      await index.write()
      const oid = await index.writeTree()
      const head = await git.Reference.nameToId(repo, 'HEAD')
      const parent = await repo.getCommit(head)
      const sig = await repo.defaultSignature()
      const commit = await repo.createCommit('HEAD', sig, sig, message, oid, [parent])
      return {
        _id: commit
      }
    },

    async checkout (sha) {
      const repo = await git.Repository.open(dataDirectory)
      const commit = await repo.getCommit(sha)
      const tree = await commit.getTree()
      await git.Checkout.tree(repo, tree, {
        checkoutStrategy: git.Checkout.STRATEGY.FORCE
      })
    },

    async revert () {
      const repo = await git.Repository.open(dataDirectory)
      const index = await repo.refreshIndex()
      await index.addAll()
      await index.write()
      const head = await git.Reference.nameToId(repo, 'HEAD')
      const headCommit = await repo.getCommit(head)
      await git.Reset.reset(repo, headCommit, git.Reset.TYPE.HARD)
    },

    async localChanges () {
      const repo = await git.Repository.open(dataDirectory)

      const index = await repo.refreshIndex()
      await index.addAll()
      await index.write()
      await index.writeTree()

      const head = await repo.getHeadCommit()
      const tree = await head.getTree()

      const diff = await git.Diff.treeToIndex(repo, tree, index)
      return diffToChanges(diff)
    },

    async history () {
      const repo = await git.Repository.open(dataDirectory)
      const master = await repo.getMasterCommit()
      const history = master.history(git.Revwalk.SORT.Time)

      return new Promise((resolve) => {
        const result = []
        history.on('commit', (commit) => {
          result.push({ date: commit.date(), message: commit.message(), _id: commit.sha() })
        })

        history.on('end', function (commits) {
          resolve(result)
        })

        history.start()
      })
    },

    async diff (sha) {
      const repo = await git.Repository.open(dataDirectory)
      const commit = await repo.getCommit(sha)
      const diffList = await commit.getDiff()
      let result = []
      for (const diff of diffList) {
        result = result.concat(await diffToChanges(diff))
      }

      return result
    },

    async pushChanges () {
      const repo = await git.Repository.open(dataDirectory)
      const remote = await repo.getRemote('origin')
      const branch = await repo.getCurrentBranch()
      const branchName = branch.shorthand()

      var authAttempted = false

      return remote.push([`refs/heads/${branchName}:refs/heads/${branchName}`], {
        callbacks: {
          certificateCheck: () => 1,
          credentials: (url, username) => getCredentials(url, username, authAttempted)
        }
      })
    },

    async localCommits (req) {
      const resp = []
      let branch = 'master'

      if (req.query.branch) {
        branch = req.query.branc
      }
      const repo = await git.Repository.open(dataDirectory)
      const revWalk = repo.createRevWalk()

      revWalk.sorting(
        git.Revwalk.SORT.TOPOLOGICAL,
        git.Revwalk.SORT.REVERSE
      )

      revWalk.pushHead()
      revWalk.hideRef(`refs/remotes/origin/${branch}`)

      async function walk () {
        let oid
        let commit
        try {
          oid = await revWalk.next()
          commit = await repo.getCommit(oid)
          resp.push({ _id: oid.tostrS(), date: commit.date(), message: commit.message() })
        } catch (error) {
          if (error.errno !== git.Error.CODE.ITEROVER) {
            throw error
          } else {
            return
          }
        }

        return walk()
      }

      await walk()

      return resp
    }
  })
}
