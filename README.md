Instructions for building bundle.js locally:

install npm: https://nodejs.org/en/
npm install -g browserify
npm install -g uglify-js

In route-spotter/
  mkdir node_modules/
  npm install git+https://github.com/transitland/finderjs.git
  npm install leaflet-polylinedecorator
  browserify js/index.js | uglifyjs > js/bundle.js
