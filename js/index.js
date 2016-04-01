/*
  Modified from:
  https://github.com/mynameistechno/finderjs/blob/master/example/example-async.js
*/
var L = require('./leaflet');
require('./leaflet.measure');
require('leaflet-polylinedecorator')
var finder = require('finderjs');
var _ = require('./util');
var $ = require('./jquery-1.12.0.min.js');

L.Icon.Default.imagePath = './images';
var refill = Tangram.leafletLayer({
  scene: 'https://raw.githubusercontent.com/tangrams/refill-style/gh-pages/refill-style.yaml',
  attribution: '<a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | <a href="http://www.openstreetmap.org/about" target="_blank">&copy; OSM contributors | <a href="https://mapzen.com/" target="_blank">Mapzen</a>',
});
var map = new L.Map('map', {
  measureControl: true
}).addLayer(refill).setView(new L.LatLng(37.7, -122.4), 6);
var rspLayer = L.layerGroup();
rspLayer.addTo(map);
var stopLayer = L.layerGroup();
stopLayer.addTo(map);

var host = 'http://localhost:3000' //'https://transit.land';
var pagination = {per_page: 1000, total: true};
var container = document.getElementById('finder');
var loadingIndicator = createLoadingColumn();
var emitter = finder(container, remoteSource, {});

function remoteSource(parent, cfg, callback) {

  stopLayer.clearLayers();
  if (!parent || parent.type !== 'stop') {
    cfg.emitter.emit('create-column', loadingIndicator);
    rspLayer.clearLayers();
  }
  if (parent) {
    if (parent.type === 'region') {
      regionClicked(parent, cfg, callback);
    }
    else if (parent.type === 'operator') {
      operatorClicked(parent, cfg, callback);
    }
    else if (parent.type === 'route') {
      routeClicked(parent, cfg, callback);
    }
    else if (parent.type === 'rsp') {
      rspClicked(parent, cfg, callback);
    }
    else if (parent.type === 'stop') {
      stopClicked(parent.distance, parent.label, parent.previous, parent.next);
    } else {}
  }
  else {
    loadRegions(parent, cfg, callback);
  }

}

function loadRegions(parent, cfg, callback) {
  // for now region is metro
  $.ajax({
    url: host + '/api/v1/operators.json?' + $.param(pagination),
    dataType: 'json',
    async: true,
    success: function(data) {
      var finder_data = {};
      $.each(data.operators, function(i, operator) {
        if (operator.metro === null) operator.metro = 'Unknown';
        if (finder_data.hasOwnProperty(operator.metro)) {
          finder_data[operator.metro].operators.push(operator.onestop_id);
        }
        else {
          finder_data[operator.metro] = {
            id: operator.metro,
            label: operator.metro,
            type: 'region',
            operators: [operator.onestop_id]
          };
        }
      });
      finder_data = $.map(finder_data, function(metro_data, index) {
        return [metro_data];
      }).sort(function (a, b) { return a.label.localeCompare(b.label); });
      callback(finder_data);
      _.remove(loadingIndicator);
    }
  });
}

function regionClicked(parent, cfg, callback) {
  var finder_data = $.map(parent.operators, function(operator_onestop_id) {
    return {
      id: operator_onestop_id,
      label: operator_onestop_id,
      type: 'operator'
    }
  });
  callback(finder_data);
  _.remove(loadingIndicator);
}

function operatorClicked(parent, cfg, callback) {
  var params = {operatedBy: parent.id};
  $.extend(params,pagination);
  $.ajax({
    url: host + '/api/v1/routes.json?' + $.param(params),
    dataType: 'json',
    async: true,
    success: function(data) {
      var finder_data = $.map(data.routes, function(route) {
        return {
          label: route.onestop_id,
          type: 'route',
          route_stop_patterns: route.route_stop_patterns_by_onestop_id,
        }
      });
      callback(finder_data);
      _.remove(loadingIndicator);
    }
  });
}

function routeClicked(parent, cfg, callback) {
  var finder_data = $.map(parent.route_stop_patterns, function(rsp_id) {
    return {
      label: rsp_id,
      type: 'rsp'
    }
  });
  callback(finder_data);
  _.remove(loadingIndicator);
}

function rspClicked(parent, cfg, callback) {
  var params = {onestop_id: parent.label};
  $.extend(params,pagination);
  $.ajax({
    url: host + '/api/v1/route_stop_patterns.json?' + $.param(params),
    dataType: 'json',
    async: true,
    success: function(data) {
      var stop_pattern = data.features[0].properties.stop_pattern;
      var stop_distances = data.features[0].properties.stop_distances;
      var finder_data = $.map(stop_pattern, function(stop_onestop_id, i) {
        var previous = (i != 0) ? stop_pattern[i-1] : null;
        var next = (i != stop_pattern.length - 1) ? stop_pattern[i+1] : null;
        return {
          label: stop_onestop_id,
          type: 'stop',
          distance: stop_distances[i],
          previous: previous,
          next: next
        }
      });
      displayRSP(data);
      callback(finder_data);
      _.remove(loadingIndicator);
    }
  });
}

function displayRSP(rsp_data) {
  var geojson = L.geoJson(rsp_data, {
    onEachFeature: function (feature, layer) {
      layer.bindPopup(feature.id);
      if (feature.properties['color']) layer.setStyle({color: '#' + feature.properties['color']});
      var p = L.polylineDecorator(layer, {patterns: [
          {repeat: 50, symbol: L.Symbol.arrowHead({pixelSize: 15, pathOptions: {fillOpacity: 1, weight: 0}}) }
        ]}
      );
      rspLayer.addLayer(layer);
      rspLayer.addLayer(p);
    }
  });
  map.fitBounds(geojson.getBounds());
}

function stopClicked(stop_distance, stop_onestop_id, previous, next) {
  var params = {onestop_id: stop_onestop_id};
  $.extend(params,pagination);
  $.ajax({
    url: host + '/api/v1/stops.geojson?' + $.param(params),
    dataType: 'json',
    async: true,
    success: function(stop_data) {
      var geojson = L.geoJson(stop_data, {
        onEachFeature: function (feature, layer) {
          layer.bindPopup(feature.id + '<br/>' +
                          'Distance traveled: '+  stop_distance);
        }
      });
      stopLayer.addLayer(geojson);
      map.fitBounds(geojson.getBounds());
    }
  });
}

function createLoadingColumn() {
  var div = _.el('div.fjs-col.leaf-col');
  var row = _.el('div.leaf-row');
  var text = _.text('Loading...');
  var i = _.el('span');

  _.addClass(i, ['fa', 'fa-refresh', 'fa-spin']);
  _.append(row, [i, text]);

  return _.append(div, row);
}
