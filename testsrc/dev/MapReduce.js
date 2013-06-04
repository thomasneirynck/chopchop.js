define(['lib/Promise'], function(Promise) {

  function Reducer(reduceFunc, notifyNewAccumulatedValue, getAccumulator) {

    this._currentKey = null;
    this._reduce = reduceFunc;
    this.__reduceQueue = [];
    this.__getAccumulator = getAccumulator;
    this._busy = false;

    var self = this;
    this.__onReduceComplete = function(newAccumulatedValue) {
      var k = self._currentKey;
      self._busy = false;
      self._currentKey = undefined;
      notifyNewAccumulatedValue(k, newAccumulatedValue);
      self.__doNew();
      return true;
    }
  }

  Reducer.prototype = {
    __doNew: function() {

      if (this._busy) {
        return;
      }

      var kv = this.__reduceQueue.pop();
      var k, v, accum;
      if (!kv) {
        return;
      }
      k = kv[0];
      v = kv[1];
      accum = this.__getAccumulator(k);
      this._currentKey = k;

      this._busy = true;
      Promise.when(this._reduce(accum, v), this.__onReduceComplete);
    },
    pushKeyValue: function(key, value) {
      this.__reduceQueue.push([key, value]);
      this.__doNew();
    },
    isEmpty: function() {
      return this._busy === false && this.__reduceQueue.length === 0;
    }
  };

  function reducerIsEmpty(e) {
    return e.isEmpty()
  }

  function MapReduce(doneNotif, options) {

    var self = this;

    var mappers = options.mappers;
    var reducers = options.reducers;

    this._partition = options.partition;
    this._inputIterator = options.inputIterator;
    this._inputQueue = [];

    this._resultMap = {};
    this._mapperNodes = mappers.slice();
    this._totalMaps = mappers.length;
    this._noMoreInputs = false;
    this._doneNotif = doneNotif;

    var acceptNotify = function(key, value) {
      self._resultMap[key] = value;
      self._process();
    };
    var getAccum = function(key) {
      return self._resultMap[key];
    };

    this._reducerNodes = reducers.map(function(reducer) {
      return new Reducer(reducer, acceptNotify, getAccum);
    });

    this.__onInputSuccess = function(input) {
      self._inputQueue.push(input);
      self._process();
      self.__nextInput();
      return;
    };

    this.__onInputError = function(er) {
      self._noMoreInputs = true;
      self._process();
    };

    this._activated = false;
  }

  MapReduce.prototype = {

    _process: function() {

      if (this._done) {
        return;
      }

      var noBusyMapNodes = (this._totalMaps === this._mapperNodes.length);
      var noBusyReduceNodes = this._reducerNodes.every(reducerIsEmpty);
      var noMoreData = this._noMoreInputs;

      if (noMoreData && noBusyMapNodes && noBusyReduceNodes) {
        this._done = true;
        this._doneNotif(this._resultMap);
        return;
      } else {
        //perform map tasks.
        if (this._inputQueue.length > 0) {
          this.__doMap();
        }
      }
    },

    __doMap: function() {

      if (this._mapperNodes.length === 0) {
        //no map nodes available. must wait.
        return;
      }

      var input = this._inputQueue.pop();
      var self = this;
      var mapperNode = this._mapperNodes.pop();

      var doneMapping = function(map) {

        //reclaim map node.
        self._mapperNodes.push(mapperNode);

        var reduceIndex;
        //reduce nodes.
        for (var key in map) {
          if (map.hasOwnProperty(key)) {
            reduceIndex = self._partition(key, self._reducerNodes.length);
            self._reducerNodes[reduceIndex].pushKeyValue(key, map[key]);
          }
        }
        self._process();
      };

      Promise.when(mapperNode(input), doneMapping);
    },

    run: function() {
      this.__nextInput();
    },

    __nextInput: function() {
      if (this._noMoreInputs) {
        return;
      }
      var next;
      try {
        next = this._inputIterator.next();
        Promise.when(next, this.__onInputSuccess, this.__onInputError);
      } catch (e) {
        this.__onInputError(e);
      }
    }
  };

  /**
   * return this as a thenable.
   */
  return function(options) {
    var p = new Promise();
    setTimeout(function() {
      var mr = new MapReduce(function(e) {
        p.resolve(e);
      }, options);
      mr.run();
    }, 0);
    return p.thenable();
  };

});