
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string', enum: ['git'] }
  }
}

module.exports = {
  'name': 'version-control-git',
  'main': 'lib/main.js',
  'dependencies': ['templates', 'fs-store', 'version-control'],
  'optionsSchema': {
    versionControl: { ...schema },
    extensions: {
      'version-control': { ...schema }
    }
  }
}
