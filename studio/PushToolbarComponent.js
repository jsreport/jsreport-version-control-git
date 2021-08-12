import Studio from 'jsreport-studio'

const PushToolbar = () => {
  const openLocalCommits = (e) => {
    e.stopPropagation()
    // Open tab
    Studio.openTab({ key: 'LocalCommitsPage', editorComponentKey: 'localCommits', title: 'Local Commits' })
  }

  return <div
    title="Push all un-pushed commits"
    className="toolbar-button"
    onClick={(e) => openLocalCommits(e)}>
    <i className="fa fa-upload"></i>
    <span>Push Changes</span>
  </div>
}

export default PushToolbar
