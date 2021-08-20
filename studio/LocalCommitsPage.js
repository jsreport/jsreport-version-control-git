import { Component } from 'react'

import Studio from 'jsreport-studio'
import style from './VersionControlGit.scss'

export default class LocalCommitsPage extends Component {
  constructor (props) {
    super(props)
    this.state = { inExecution: false, commits: [], error: null, ready: false }
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
      const res = await Studio.api.get('/api/version-control-git/local-commits')
      this.setState({ commits: res, ready: true })
    } catch (e) {
      // eslint-disable-next-line no-undef
      // alert(e)
    } finally {
      this.fetchRequested = false
    }
  }

  async push () {
    if (this.state.inExecution) {
      return
    }

    this.setState({ inExecution: true })

    try {
      const res = await Studio.api.get('/api/version-control-git/status')
      if (res.length === 0) {
        this.setState({ ready: false })
        await Studio.api.post('/api/version-control-git/push')
        this.setState({ error: null, inExecution: false })
        await this.load()
      } else {
        Studio.openTab({ key: 'RemotePullPage', editorComponentKey: 'remotePull', title: 'New Changes from Remote' })
        this.setState({ error: null, inExecution: false })
      }
    } catch (e) {
      this.setState({ inExecution: false, ready: false })
      // eslint-disable-next-line no-undef
    }
  }

  history () {
    Studio.openTab({ key: 'versionControlHistory', editorComponentKey: 'versionControlHistory', title: 'Commits history' })
  }

  render () {
    return (
      <div className='block custom-editor'>
        <h2>
          <i className='fa fa-history' /> Unpushed Commits
          <button className='button confirmation' onClick={() => this.history()}>Commits history</button>
        </h2>
        { this.state.ready && (this.state.commits.length > 0
          ? <div className={style.listContainer + ' block-item'}>
            <table className={style.table + ' table'}>
              <thead>
                <tr>
                  <th>date</th>
                  <th>message</th>
                </tr>
              </thead>
              <tbody>
                {this.state.commits.map((h) => (
                  <tr key={h._id}>
                    <td>{h.date.toLocaleString()}</td>
                    <td>{h.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className={style.pushButton + ' button confirmation'} onClick={() => this.push()}>Continue Push</button>
          </div>
          : <p>No commits to push</p>)}
      </div>
    )
  }
}
