define([
  'lib/MapReduce',
  'lib/Promise'
], function(MapReduce, Promise) {

  module('MapReduce');

  function LineIterator() {
    this._objects = ['you load sixteen tons', 'what do you get', 'a day older', 'and deeper in debt', 'and sixteen tons', 'well thats quite something', 'something feels fishy'];
  }

  LineIterator.prototype = {
    next: function() {
      var ob = this._objects.pop();
      return {
        then: function(suc, error) {
          setTimeout(function() {
            var v;
            if (ob) {
              v = suc(ob);
            } else {
              v = error('done iterating');
            }
          }, 1);
        }
      };
    }
  };

  asyncTest('test map reduce - word count example', function() {

    var mapnodes = 2;
    var reducenodes = 2;

    var mapperNodes = (function() {
      var a = [];
      for (var i = 0; i < mapnodes; i += 1) {
        a.push(Promise.promisifyWebWorker('worker/groupCountWorker.js'));
      }
      return a;
    }());

    var reducerNodes = (function() {
      var a = [];
      for (var i = 0; i < reducenodes; i += 1) {
        a.push(Promise.promisifyWebWorker('worker/sumWorker.js', {
          mapArguments: function(acc, value) {
            return [acc, value];
          }
        }));
      }
      return a;
    }());

    var partition = function(a) {
      if (a < 'middle') {
        return 0;
      } else {
        return 1;
      }
    };

    var iterator = new LineIterator();

    var testMapReduce = new MapReduce({
      mappers: mapperNodes,
      reducers: reducerNodes,
      partition: partition,
      inputIterator: iterator
    });

    testMapReduce.then(function(result) {
      var ref = {"something": 2, "feels": 1, "fishy": 1, "well": 1, "quite": 1, "thats": 1, "you": 2, "load": 1, "tons": 2, "sixteen": 2, "do": 1, "get": 1, "what": 1, "a": 1, "older": 1, "day": 1, "and": 2, "debt": 1, "in": 1, "deeper": 1};
      for (var i in ref) {
        if (ref.hasOwnProperty(i)) {
          equal(result[i], ref[i], 'does not match ref result for ' + i);
        }
      }
      start();
    });

  });

});



