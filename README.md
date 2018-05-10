# jsreport-version-control-git
[![NPM Version](http://img.shields.io/npm/v/jsreport-version-control-git.svg?style=flat-square)](https://npmjs.com/package/jsreport-version-control-git)
[![Build Status](https://travis-ci.org/jsreport/jsreport-version-control-git.png?branch=master)](https://travis-ci.org/jsreport/jsreport-version-control-git)

This creates local [git](https://git-scm.com/) repository in `data` directory and provide versioning implementation for 
[jsreport-version-control](https://github.com/jsreport/jsreport-version-control) extension. The package includes the git node binding and doesn't require the full git to be installed.

## Installation

```bash
npm install jsreport-version-control
npm install jsreport-version-control-git
```

```js
{
  "versionControl": { "provider": "git" } 
}
```

## jsreport-core
You can apply this extension also manually to [jsreport-core](https://github.com/jsreport/jsreport-core)

```js
var jsreport = require('jsreport-core')()
jsreport.use(require('jsreport-version-control')({ provider: 'git' }))
jsreport.use(require('jsreport-version-control-git')())
```
