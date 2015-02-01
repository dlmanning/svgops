var allVessels = [];
var binarySearch = require('binary-search-bounds');

function Vessel (id, vesselName, hotSpot, parent, children) {
  if (Array.isArray(id)) {
    return Vessel.apply(this, id);
  }

  var self = this;

  this.id = parseInt(id, 10);
  this.vesselName = vesselName;
  this.hotSpot = hotSpot;
  this.paths = {
    alpha: [],
    beta: []
  };

  this.parent = parseInt(parent, 10) || null;
  this.children = [];

  children.split(',').forEach(function(id) {
    if (id.length) {
      self.children.push(parseInt(id, 10));
    }
  });

  allVessels.push(this);

  return this;
}

// TODO: rename this function and clean it the hell up!
Vessel.prototype.findOppositePoint = function (point) {
  // get point index and relative index
  // floor(relative-index * length of other path)
  // return point at that index on other path

  var sides = this.getSides();

  var oppositeOf = {
    "alpha": "beta",
    "beta": "alpha"
  };

  var pointLocation = (function findPoint (x) {
    if (!x[0]) return null;

    var currentSide = x.pop();

    for (var i = 0; i < sides[currentSide].length; i++) {
      if (sides[currentSide][i][0] === point[0] && sides[currentSide][i][1] === point[1]) {
        return {side: currentSide, index: i};
      }
    }

    return findPoint(x);
  })(['alpha', 'beta']);

  var oppositeIndex = Math.floor(sides[oppositeOf[pointLocation.side]].length *
                                 pointLocation.index / sides[pointLocation.side].length);

  var oppositePoint = sides[oppositeOf[pointLocation.side]][oppositeIndex];

  var result = {
    original: point,
    opposite: oppositePoint
  };

  result[pointLocation.side] = point;
  result[oppositeOf[pointLocation.side]] = oppositePoint;

  return result

}

Vessel.prototype.getSides = function () {
  var alpha = this.paths.alpha,
      beta = this.paths.beta;

  var a = [];
  var b = [];

  alpha.slice().reverse().forEach(extend(a));
  beta.forEach(extend(b));

  return {
    alpha: a.slice().reverse(),
    beta: b
  };

}

Vessel.prototype.getGeometry = function () {

  var sides = this.getSides();

  return sides.alpha.slice().reverse().concat(sides.beta);

}

Vessel.prototype.getPartialGeometry = function (endpoint, direction) {
  var sides = this.getSides();

  var idxAlpha;
  var idxBeta;

  for (idxAlpha = 0; idxAlpha < sides.alpha.length; idxAlpha++) {
    if (endpoint.location.alpha[0] === sides.alpha[idxAlpha][0] &&
        endpoint.location.alpha[1] === sides.alpha[idxAlpha][1]) {
          break;
    }
  }

  for (idxBeta = 0; idxBeta < sides.alpha.length; idxBeta++) {
    if (endpoint.location.beta[0] === sides.beta[idxBeta][0] &&
        endpoint.location.beta[1] === sides.beta[idxBeta][1]) {
          break;
    }
  }


  if (direction === 'antegrade') {
    return sides.alpha.slice(idxAlpha).reverse().concat(sides.beta.slice(idxBeta));
  } else if (direction === 'retrograde') {
    return sides.alpha.slice(0, idxAlpha).reverse().concat(sides.beta.slice(0, idxBeta));
  }
}

Vessel.prototype.getVoronoiGeometry = function () {
    var self = this;

    var exclusionSet = [];

    var paths = self.paths;

    for (var side in paths) {
      paths[side].forEach(function (segment) {
        if (segment.branch) {
          extend(exclusionSet)(segment);
          segment.points.forEach(function (point) {
            exclusionSet.push(self.findOppositePoint(point).opposite);
          });
        }
      });
    }

    exclusionSet.sort(ptsCmp);

    var allPoints = self.getGeometry();

    return allPoints.filter(function (point) {
      return (binarySearch.eq(exclusionSet, point, ptsCmp) === -1);
    });

    function ptsCmp (p1, p2) {
      if (p1[0] !== p2[0]) {
        return p2[0] - p1[0];
      }

      return p2[1] - p1[1];
    }
}

function getPath (src, dest) {
  var self = this;
  var path = [];

  return depthFirstSearch(src, path, null);

  function depthFirstSearch (node, path, last) {
    var adjacencies = node.children.concat(node.parent);
    var result;

    path.push(node);
    if (node === dest) return path;

    for (var i = 0; i < adjacencies.length; i++) {
      if (adjacencies[i] !== last) {
        result = depthFirstSearch(adjacencies[i], path.slice(), node);
      }

      if (result) {
        return result;
      }
    }

    return null;
  }
}

function extend (a) {
  return function (b) {
    b = b.points;

    var i = a.length;
    a.length += b.length;
    for (var j = 0; j < b.length; ++i, ++j) {
      a[i] = b[j];
    }
  }
}

var data =
  "1:rt-coronary:origin::2\n" +
  "2:rt-coronary:proximal:1:3,4\n" +
  "3:rt-coronary:mid:2:5,6\n" +
  "4:artery-to-SA-node:origin:2:7\n" +
  "5:acute-marginal:origin:3:8\n" +
  "6:rt-coronary:distal:3:9,10,11,12\n" +
  "7:artery-to-SA-node:default:4:\n" +
  "8:acute-marginal:proximal:5:13\n" +
  "9:posterior-descending-1:origin:6:14\n" +
  "10:posterior-descending-2:origin:6:15\n" +
  "11:artery-to-AV-node:origin:6:16\n" +
  "12:posterolateral-branch-1:origin:6:17\n" +
  "13:acute-marginal:mid:8:18\n" +
  "14:posterior-descending-1:default:9:\n" +
  "15:posterior-descending-2:default:10:\n" +
  "16:artery-to-AV-node:default:11:\n" +
  "17:posterolateral-branch-1:default:12:19\n" +
  "18:acute-marginal:distal:13:\n" +
  "19:posterolateral-branch-2:origin:17:20\n" +
  "20:posterolateral-branch-2:default:19:";

var vessels = [];

var lines = data.split('\n');
lines.forEach(function (line) {
  vessels.push(new Vessel(line.split(':')));
});

vessels.forEach(function (vessel) {
  vessel.parent = getVesselById(vessel.parent);
  vessel.children = vessel.children.map(getVesselById);
});

function getVesselById (id) {
  for (var i = 0; i < allVessels.length; i++) {
    if (allVessels[i].id === id) {
      return allVessels[i];
    }
  }

  return id;
}

vessels.getPath = getPath;

module.exports = vessels;
