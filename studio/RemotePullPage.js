import { Component } from 'react'

import Studio from 'jsreport-studio'
import DownloadBigFileModal from './DownloadBigFileModal'
import style from './VersionControlGit.scss'

export default class RemotePullPage extends Component {
  constructor (props) {
    super(props)
    this.state = { inExecution: false, diff: [], error: null, ready: false }
  }

  onTabActive () {
    this.load()
  }

  async load () {
    if (this.fetchRequested) {
      return
    }

    this.fetchRequested = true

    try {
      const res = await Studio.api.get('/api/version-control-git/status')
      this.setState({ diff: res, ready: true })
    } catch (e) {
      // eslint-disable-next-line no-undef
      alert(e)
    } finally {
      this.fetchRequested = false
    }
  }

  operationIcon (operation) {
    switch (operation) {
      case 'insert': return 'fa fa-plus'
      case 'remove': return 'fa fa-eraser'
      case 'update': return 'fa fa-pencil'
    }
  }

  async openDiff (change) {
    if (change.type === 'bigfile') {
      return Studio.openModal(DownloadBigFileModal, {
        change
      })
    }

    Studio.customPreview('/api/version-control/diff-html', { patch: change.patch })
  }

  async pull () {
    if (this.state.inExecution) {
      return
    }

    this.setState({ inExecution: true })

    try {
      await Studio.api.get('/api/version-control-git/merge')
      this.load()

      this.setState({ error: null, inExecution: false })
    } catch (e) {
      this.setState({ error: e, inExecution: false, ready: false })
      await this.load()
    }
  }

  renderChange (c) {
    return (
      <tbody key={`${c.entitySet}-${c.path}`}>
        <tr onClick={() => this.openDiff(c)}>
          <td style={{ textAlign: 'center' }}><i className={this.operationIcon(c.operation)} /></td>
          <td>{c.path}</td>
          <td>{c.entitySet}</td>
        </tr>
      </tbody>
    )
  }

  render () {
    return (
      <div className='block custom-editor'>
        <h2>
          <i className='fa fa-history' /> Changes from Remote
        </h2>
        { this.state.ready && (this.state.diff.length > 0
          ? <div className={style.listContainer + ' block-item'}>
            <table className={style.table + ' table'}>
              <thead>
                <tr>
                  <th style={{ width: '20px' }}>operation</th>
                  <th>path</th>
                  <th>entity set</th>
                </tr>
              </thead>
              {this.state.diff.map((c) => this.renderChange(c))}
            </table>
            <button className={style.pushButton + ' button confirmation'} onClick={() => this.pull()}>Continue Pull</button>
          </div>
          : <p>No changes to pull</p>)}
      </div>
    )
  }
}
