/*
  Modified from:
  https://github.com/mynameistechno/finderjs/blob/master/example/example-async.js
*/
var L = require('./leaflet');
require('./leaflet.measure');
var finder = require('finderjs');
var _ = require('./util');
var $ = require('./jquery-1.12.0.min.js');

L.Icon.Default.imagePath = './images';
var layerOsm = new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  subdomains: ["a", "b", "c"],
  maxZoom: 18
});
var map = new L.Map('map', {
  measureControl: true
}).addLayer(layerOsm).setView(new L.LatLng(37.7, -122.4), 6);
var rspLayer = L.layerGroup();
rspLayer.addTo(map);
var stopLayer = L.layerGroup();
stopLayer.addTo(map);

var host = 'http://transit.land';
var pagination = 'per_page=1000&total=true';
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
      displayStop(parent.rsp, parent.label, parent.index);
    } else {}
  }
  else {
    loadOperators(parent, cfg, callback);
  }

}

function loadOperators(parent, cfg, callback) {
  $.ajax({
    url: host + '/api/v1/operators.json?' + pagination,
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
  $.ajax({
    url: host + '/api/v1/routes.json?operatedBy=' + parent.label + '&' + pagination,
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
  $.ajax({
    url: host + '/api/v1/route_stop_patterns.geojson?onestop_id=' + parent.label + '&' + pagination,
    dataType: 'json',
    async: true,
    success: function(data) {
      stop_pattern = data.features[0].properties.stop_pattern;
      var finder_data = $.map(stop_pattern, function(stop_onestop_id, i) {
        var index = 0;
        if (i == 0) index = -1;
        else if (i == stop_pattern.length - 1) index = 1;
        return {
          label: stop_onestop_id,
          type: 'stop',
          rsp: parent.label,
          index: index
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
    }
  });
  map.fitBounds(geojson.getBounds());
  rspLayer.addLayer(geojson);
}

function getStop(stop_onestop_id, distance) {
  $.ajax({
    url: host + '/api/v1/stops.geojson?onestop_id=' + stop_onestop_id + '&' + pagination,
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

function displayStop(route_stop_pattern_onestop_id, stop_onestop_id, stop_index) {
  var stop_query = stop_index === 1 ? '&destination_onestop_id=' : '&origin_onestop_id='
  stop_query += stop_onestop_id
  query = '/api/v1/schedule_stop_pairs.json?route_stop_pattern_onestop_id=' + route_stop_pattern_onestop_id
  query += stop_query;
  query += '&' + pagination;
  var distance;
  $.ajax({
    url: host + query,
    dataType: 'json',
    async: true,
    success: function(data) {
      if (stop_index === 1) distance = data.schedule_stop_pairs[0].destination_dist_traveled;
      else distance = data.schedule_stop_pairs[0].origin_dist_traveled;
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
