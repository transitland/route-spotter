Open index.html in a supported browser.

In order to make edits and build bundle.js locally:

`install npm: https://nodejs.org/en/`  
`npm install -g browserify`  
`npm install -g uglify-js`

In route-spotter/  
1.  `mkdir node_modules/`  
2.  `npm install
git+https://github.com/transitland/finderjs.git`  
3.  `npm install leaflet-polylinedecorator`  
4.  `browserify js/index.js | uglifyjs > js/bundle.js`
