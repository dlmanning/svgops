var d3 = require('d3/d3');
var uniq = require('uniq');
var vesselGraph = require('./data');
var state = require('./fsm');

require('whatwg-fetch');

var vp = document.getElementById('viewport');

fetch('pretty.svg')
  .then(function (resp) {
    return resp.text();
  })
  .then(function (svgSource) {
    vp.innerHTML = svgSource;
    main(vp.querySelector('svg'));
  })
  .catch(function (err) {
    throw err;
  });

function main (svgRoot) {
  var $outlines = d3.select(svgRoot.querySelector('#outlines'));
  var height = 792, width = 612;

  var paths = svgRoot.querySelectorAll('path');

  forEach(paths, function (path) {
    var parent = path.parentNode;
    var grandParent = parent.parentNode;

    var side = parent.classList[0];
    var hotSpot = grandParent.classList[0];
    var group = grandParent.parentNode.id;

    var vessel = getVessel(group, hotSpot);

    var samplePoints = sample(path, 0.1);

    vessel.paths[side].push({
      points: samplePoints,
      branch: Boolean(path.dataset.branch)
    });
  });

  var cancelButton = document.getElementById('cancel-button');
  cancelButton.addEventListener('click', function () {
    state.handle('button.cancel');
  });

  var $clickable = d3.select(svgRoot.querySelector('#clickable'));

  var $initialSegment = $clickable.append('g').attr('id', 'initial-segment').selectAll('path');
  var $hotSpotPaths = $clickable.append('g').attr('id', 'hotspots');
  var $stenosisOverlay = $clickable.append('g').attr('id', 'stenosis').selectAll('path');
  var $voronoi = $clickable.append('g').attr('id', 'voronoi');

  var line = d3.svg.line().interpolate('basis-closed');
  var voronoi = d3.geom.voronoi().clipExtent([[5, 5], [1000, 1000]]);

  vesselGraph.forEach(function (vessel) {

    $hotSpotPaths.append('path')
      .data([vessel.getGeometry()])
      .attr('d', line)
      .attr('fill', 'white')
      .attr('opacity', 0)
      .attr('id', vessel.vesselName + '_' + vessel.hotSpot)
      .on('mouseenter', function () {
        state.handle('mouse.enter', {vessel: vessel, node: d3.event.target});
      })
      .on('mouseleave', function () {
        state.handle('mouse.leave', {vessel: vessel, node: d3.event.target});
      })
      .on('click', function () {
        state.handle('select.hotSpot', {vessel: vessel, node: d3.event.target});
      });

  });

  var vesselNameDisplay = document.getElementById('vessel-name');

  state.on('new.selection', function (vessel, node) {
    vesselNameDisplay.innerHTML = "<p>" + vessel.vesselName + "-" + vessel.hotSpot + "</p>";
    node.classList.add('highlight');
  });

  state.on('clear.selection', function (node) {
    vesselNameDisplay.innerHTML = '';
    node.classList.remove('highlight');
  });


  state.on('hotSpot.selected', function () {
    cancelButton.setAttribute('style', '');
  });

  state.on('state.hotSpot.selection', function () {
    cancelButton.setAttribute('style', 'display: none;');
    vesselNameDisplay.innerHTML = '';
  });

  state.on('state.stenosis.beginning', function () {
    var vessel = state.currentVessel;

    var points = vessel.getVoronoiGeometry();

    // uniq(points, function (p1, p2) {
    //   return (distance(p1, [0, 0]) - distance(p2, [0, 0]) < 0.001);
    // });

    $voronoi
      .selectAll('path')
    .data(voronoi(points)).enter()
      .append('path')
      .attr('d', function (d) {
        return 'M' + d.join('L') + 'Z';
      })
      .attr('fill', 'white')
      .attr('opacity', 0)
      .attr('stroke', 'black')
      .attr('stroke-opacity', 1)
      .attr('stroke-width', 0.1)
      .on('mouseenter', function (voronoiPoints) {
        var point = voronoiPoints.point;
        state.handle('mouse.enter', point);
      })
      .on('mouseleave', function () {
        state.handle('mouse.leave');
      })
      .on('click', function (voronoiPoints) {
        var point = voronoiPoints.point;
        state.handle('select.stenosis.beginning', point);
      })

  });

  state.on('state.stenosis.beginning.exit', function () {
    $voronoi.node().innerHTML = '';
  });

  state.on('boing', function (p1, p2) {
    $initialSegment = $initialSegment.data([[p1, p2]]);

    $initialSegment.exit().remove();

    $initialSegment.enter()
      .append('path')
      .attr('stroke', 'black')
      .attr('stroke-width', 0.1)

    $initialSegment.attr('d', function (d) { return 'M' + d.join('L') + 'Z'});

  });

  state.on('state.stenosis.additional', function () {
    var voronoiPoints = [];
    var aMap = new WeakMap();

    vesselGraph.forEach(function (vessel) {
      var vesselPoints = vessel.getVoronoiGeometry();
      vesselPoints.forEach(function (point) {
        aMap.set(point, vessel);
      });

      voronoiPoints = voronoiPoints.concat(vesselPoints);
    });

    $voronoi
      .selectAll('path')
    .data(voronoi(voronoiPoints)).enter()
      .append('path')
      .attr('d', function (d) {
        return 'M' + d.join('L') + 'Z';
      })
      .attr('fill', 'white')
      .attr('opacity', 0)
      .attr('stroke', 'black')
      .attr('stroke-opacity', 1)
      .attr('stroke-width', 0.1)
      .on('mouseenter', function (voronoiPoints) {
        state.handle('mouse.enter', {
          voronoiPoints: voronoiPoints,
          vessel: aMap.get(voronoiPoints.point)
        });
      })

  });

  state.on('additional.stenosis.hover', function (payload) {

    var beginning = payload.beginningVessel;
    var ending = payload.endingVessel;

    var path = vesselGraph.getPath(beginning, ending);

    var direction = (path[0].parent === path[1]) ? 'retrograde' : 'antegrade'

    var oppositeOf = {
      'antegrade': 'retrograde',
      'retrograde': 'antegrade'
    };

    $stenosisOverlay = $stenosisOverlay.data(path);

    $stenosisOverlay.enter()
      .append('path')
      .attr('fill', '#BADA55')
      .attr('opacity', 0.8);

    $stenosisOverlay.attr('d', function (vessel, idx) {
        if (idx === 0) {
          return line(vessel.getPartialGeometry(payload.stenosisBeginning, direction));
        } else if (idx === path.length - 1) {
          return line(vessel.getPartialGeometry({
            location: ending.findOppositePoint(payload.voronoiPoints.point)
          }, oppositeOf[direction]));
        } else {
          return line(vessel.getGeometry());
        }
    });

    $stenosisOverlay.exit().remove();

  });

  state.on('state.stenosis.additional.exit', function () {
    $voronoi.node().innerHTML = '';
  });

}


// Utility functions

function ptsCmp (p1, p2) {
  if (p1[0] !== p2[0]) {
    return p2[0] - p1[0];
  }
  return p2[1] - p1[1];
}

function getVessel (vesselName, hotSpot) {

  for (var i = 0; i < vesselGraph.length; i++) {
    if (vesselGraph[i].vesselName === vesselName.slice(7) && vesselGraph[i].hotSpot === hotSpot) {
      return vesselGraph[i];
    }
  }

  return null;
}

function forEach (collection, cb) {
  [].forEach.call(collection, cb);
}

function distance (p1, p2) {
  return Math.sqrt(
    (p2[0] - p1[0]) * (p2[0] - p1[0]) +
    (p2[1] - p1[1]) * (p2[1] - p1[1])
  );
}

function sample(pathNode, precision) {
  var pathLength = pathNode.getTotalLength(),
      samples = [];

  for (var sample, sampleLength = 0; sampleLength <= pathLength; sampleLength += precision) {
    sample = pathNode.getPointAtLength(sampleLength);
    samples.push([sample.x, sample.y]);
  }

  return samples;
}
