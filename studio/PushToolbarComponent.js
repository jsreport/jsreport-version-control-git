import Studio from 'jsreport-studio'
import { useEffect, useState } from 'react'
import style from './VersionControlGit.scss'

const PushToolbar = () => {
  const [expandedToolbar, setExpandedToolbar] = useState(false)

  useEffect(() => {
    window.addEventListener('click', tryHide())
    return () => {
      window.removeEventListener('click', tryHide())
    }
  }, [])

  const tryHide = () => {
    setExpandedToolbar(false)
  }

  const openLocalCommits = (e) => {
    e.stopPropagation()
    // Open tab
    Studio.openTab({ key: 'LocalCommitsPage', editorComponentKey: 'localCommits', title: 'Local Commits' })
  }

  const openPull = async (e) => {
    e.stopPropagation()
    Studio.openTab({ key: 'RemotePullPage', editorComponentKey: 'remotePull', title: 'New Changes from Remote' })
  }

  return (
    <div
      title='Push all un-pushed commits'
      className='toolbar-button'
      onClick={(e) => openLocalCommits(e)}
    >
      <i className='fa fa-git-alt' />
      <span>Remote Git</span>
      <span className={style.runCaret} onClick={(e) => { e.stopPropagation(); setExpandedToolbar(!expandedToolbar) }} />
      <div className={style.runPopup} style={{ display: expandedToolbar ? 'block' : 'none' }}>
        <div title='Push' className='toolbar-button' onClick={(e) => openLocalCommits(e)}>
          <i className='fa fa-upload' /><span>Push Changes</span>
        </div>
        <div title='Pull' className='toolbar-button' onClick={(e) => openPull(e)}>
          <i className='fa fa-download' /><span>Pull Changes</span>
        </div>
      </div>
    </div>
  )
}

export default PushToolbar
