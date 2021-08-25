const git = require('nodegit')
const Promise = require('bluebird')
const fs = require('fs')
const path = require('path')

const utils = require('./customUtils')

module.exports = (reporter) => {
  const dataDirectory = reporter.documentStore.provider.dataDirectory

  if (!dataDirectory) {
    throw new Error('jsreport-version-control-git needs dataDirectory to be defined')
  }

  return ({
    async init () {
      reporter.logger.debug('Version control for git is initializing repository')

      const remote = reporter.options.extensions.versionControl.remote

      // TODO
      // If empty, remote repository, clone
      // If empty, and no remote repository, initialize
      // If not empty, remote repository, and no .git folder, overwrite with clone
      // If not empty, remote repository, and git folder with same remote, pull, commit, and push
      // If not empty, remote repository, and git folder with different remote, overwrite with clone
      if (remote) {
        reporter.logger.debug('Remote git repository provided')

        reporter.logger.debug('Performing clone')
        await utils.repoClone(remote, dataDirectory)

        const changes = await this.localChanges()

        if (changes.length !== 0) {
          reporter.logger.debug('data directory was not empty; copying files and performing commit')
          await this.commit('Merging in local changes')
          await this.pushChanges()
        }
      } else {
        reporter.logger.debug('No remote repository given; initializing new repository for local')
        await git.Repository.init(dataDirectory, 0)

        const repo = await git.Repository.open(dataDirectory)
        if ((repo.isEmpty()) === 0) {
          return
        }

        reporter.logger.debug('Version control for git is making initial commit')
        fs.promises.writeFile(path.join(dataDirectory, '.gitignore'), 'settings\nstorage/**/*')

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
      return utils.diffToChanges(diff)
    },

    async localChangesFromRemote () {
      const repo = await git.Repository.open(dataDirectory)
      var authAttempted = false

      await repo.fetch('origin', {
        callbacks: {
          certificateCheck: () => 1,
          credentials: (url, username) => utils.getCredentials(url, username, authAttempted)
        }
      })

      const branch = await repo.getCurrentBranch()
      const branchName = branch.shorthand()
      const remoteCommit = await repo.getReferenceCommit(`refs/remotes/origin/${branchName}`)
      const remoteTree = await remoteCommit.getTree()

      const local = await repo.getHeadCommit()
      const tree = await local.getTree()

      reporter.logger.debug('Current HEAD Commit: ' + local.sha())
      reporter.logger.debug('Latest Remote Commit: ' + remoteCommit.sha())

      var foundCommit = false

      await new Promise((resolve, reject) => {
        const eventEmitter = local.history()

        eventEmitter.on('commit', (commit) => {
          if (commit.sha() === remoteCommit.sha()) {
            reporter.logger.info('Found remote commit in local history. Already up to date.')
            foundCommit = true
            resolve()
          }
        })

        eventEmitter.on('end', resolve)
        eventEmitter.on('error', reject)

        eventEmitter.start()
      })

      if (foundCommit) return []

      const diff = await git.Diff.treeToTree(repo, tree, remoteTree, null)
      return utils.diffToChanges(diff)
    },

    async executeDiff () {
      const repo = await git.Repository.open(dataDirectory)
      const branch = await repo.getCurrentBranch()
      const branchName = branch.shorthand()
      const remoteCommit = await repo.getReferenceCommit(`refs/remotes/origin/${branchName}`)
      const remoteTree = await remoteCommit.getTree()

      const local = await repo.getHeadCommit()
      const tree = await local.getTree()

      const diff = await git.Diff.treeToTree(repo, tree, remoteTree, null)
      return await utils.diffToChanges(diff)
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
        result = result.concat(await utils.diffToChanges(diff))
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
          credentials: (url, username) => utils.getCredentials(url, username, authAttempted)
        }
      })
    },

    async performMerge () {
      const repo = await git.Repository.open(dataDirectory)

      const branch = await repo.getCurrentBranch()
      const branchName = branch.shorthand()
      const localCommit = await repo.getReferenceCommit(`refs/heads/${branchName}`)
      const remoteCommit = await repo.getReferenceCommit(`refs/remotes/origin/${branchName}`)
      const sig = await repo.defaultSignature()

      const index = await git.Merge.commits(repo, localCommit, remoteCommit, null)

      if (index.hasConflicts()) {
        await repo.refreshIndex()
        throw new Error('Merge conflict found. Aborting. Please resolve outside of the application')
      }

      const oid = await index.writeTreeTo(repo)
      return repo.createCommit('HEAD', sig, sig, `Merge remote branch origin/${branchName} into ${branchName}`, oid, [localCommit, remoteCommit])
    },

    async localCommits (req) {
      const resp = []
      let branch = 'master'

      if (req.query.branch) {
        branch = req.query.branch
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
