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

var host = 'https://transit.land';
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
    if (parent.type === 'operator') {
      loadRoutes(parent, cfg, callback);
    }
    else if (parent.type === 'route') {
      loadRouteStopPatterns(parent, cfg, callback);
    }
    else if (parent.type === 'rsp') {
      loadStops(parent, cfg, callback);
    }
    else if (parent.type === 'stop') {
      displayStop(parent.rsp, parent.label, parent.previous, parent.next);
    } else {}
  }
  else {
    loadOperators(parent, cfg, callback);
  }

}

function loadOperators(parent, cfg, callback) {
  $.ajax({
    url: host + '/api/v1/operators.json?' + $.param(pagination),
    dataType: 'json',
    async: true,
    success: function(data) {
      var finder_data = $.map(data.operators, function(operator) {
        return {
          label: operator.onestop_id,
          type: 'operator'
        }
      });
      callback(finder_data);
      _.remove(loadingIndicator);
    }
  });
}

function loadRoutes(parent, cfg, callback) {
  var params = {operatedBy: parent.label};
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

function loadRouteStopPatterns(parent, cfg, callback) {
  var finder_data = $.map(parent.route_stop_patterns, function(rsp_id) {
    return {
      label: rsp_id,
      type: 'rsp'
    }
  });
  callback(finder_data);
  _.remove(loadingIndicator);
}

function loadStops(parent, cfg, callback) {
  var params = {onestop_id: parent.label};
  $.extend(params,pagination);
  $.ajax({
    url: host + '/api/v1/route_stop_patterns.geojson?' + $.param(params),
    dataType: 'json',
    async: true,
    success: function(data) {
      stop_pattern = data.features[0].properties.stop_pattern;
      var finder_data = $.map(stop_pattern, function(stop_onestop_id, i) {
        var previous = (i != 0) ? stop_pattern[i-1] : null;
        var next = (i != stop_pattern.length - 1) ? stop_pattern[i+1] : null;
        return {
          label: stop_onestop_id,
          type: 'stop',
          rsp: parent.label,
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

function getStop(stop_onestop_id, distance) {
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
                          'Distance traveled: '+  distance);
        }
      });
      stopLayer.addLayer(geojson);
      map.fitBounds(geojson.getBounds());
    }
  });
}

function displayStop(route_stop_pattern_onestop_id, stop_onestop_id, previous, next) {
  var params = {route_stop_pattern_onestop_id: route_stop_pattern_onestop_id};
  if (previous) {
    params['origin_onestop_id'] = previous;
    params['destination_onestop_id'] = stop_onestop_id;
  }
  else {
    params['destination_onestop_id'] = next;
    params['origin_onestop_id'] = stop_onestop_id;
  }
  $.extend(params,pagination);
  query = '/api/v1/schedule_stop_pairs.json?' + $.param(params);
  var distance;
  $.ajax({
    url: host + query,
    dataType: 'json',
    async: true,
    success: function(data) {
      if (previous) {
        distance = data.schedule_stop_pairs[0].destination_dist_traveled;
      }
      else {
        distance = data.schedule_stop_pairs[0].origin_dist_traveled;
      }
      getStop(stop_onestop_id, distance);
    }
  })
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
