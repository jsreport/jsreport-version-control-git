import PushToolbar from './PushToolbarComponent'
import LocalCommitsPage from './LocalCommitsPage'

import Studio from 'jsreport-studio'

Studio.readyListeners.push(() => {
  if (!Studio.extensions['version-control-git'].options.remote) {
    return
  }

  Studio.addToolbarComponent(PushToolbar, 'right')
  Studio.addEditorComponent('localCommits', LocalCommitsPage)
})