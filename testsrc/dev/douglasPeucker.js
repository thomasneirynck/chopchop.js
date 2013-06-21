define([], function() {


  //super fast, low garbage douglas peucker algorithm.
  var Coordinates = (function() {
    var mixin = {
      getXY: function(index, out_) {
        index *= 2;
        out_.x = index;
        out_.y = index + 1;
      },
      forEachXY: function(cb) {
        for (var i = 0, l = this.length * 2; i < l; i += 2) {
          cb(i, i + 1);
        }
      },
      reduceXY: function(cb, accumulator) {
        for (var i = 0, l = this.length * 2; i < l; i += 2) {
          accumulator = cb(accumulator, i, i + 1);
        }
        return accumulator;
      },
      size: function() {
        return this.length / 2;
      }
    };

    return function() {
      var a = [];
      a.forEachXY = mixin.forEachXY;
      return a;
    }
  }());

  function douglasPeucker(pointlist, epsilon, start, end) {
    var max = 0;
    var index = 0;
    for (index = 1; index < pointlist.length - 1; i += 1) {
    }
  }

  //working array for faster access.
  var tempArray = new Array(1000);
  var i = 0;

  function ingest(x, y) {
    var ind = i * 2;
    tempArray[ind] = x;
    tempArray[ind + 1] = y;
    i += 1;
  }

  return {
    simplify: function(coordinateArray, accuracy) {
      //read in xy's in the temparray (better locality in most JS runtime -> access is faster).
      i = 0;
      coordinateArray.forEachXY(ingest);
      tempArray.length = i;//truncate the array.
      return douglasPeucker(coordinateArray, accuracy, make());
    },
    simplifyPoints: function() {
    }
  }
});