var main = require('./main.js')
var config = require('./jsreport.config.js')

module.exports = function (options) {
  config = Object.assign({}, config)
  config.directory = __dirname
  config.options = Object.assign({}, options)
  config.main = main
  return config
}
