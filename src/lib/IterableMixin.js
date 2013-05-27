if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(['./Promise'], function (Promise) {

  "use strict";

  var $N = {};

  /**
   * polyfill for getting the current date.
   */
  var now = (function () {
    if (typeof Date.now === 'function') {
      return Date.now;
    } else {
      return function () {
        return new Date().getTime();
      };
    }
  }());

  /**
   * handler for throwing an error
   * @param e
   */
  var propagateError = function (e) {
    throw e;
  };

  /**
   * default ticker. breaks the callstack.
   */
  var timeoutTicker = (function () {
    if (window.setImmediate) {
      return function (cb) {
        return window.setImmediate(cb);
      };
    } else {
      return function (cb) {
        return setTimeout(cb, 0);
      };
    }
  }());

  /**
   * returns a function which returns the next element of the iterable.
   * @param iterable. can be an object that implements .next or an array.
   * @returns {Function}
   */
  var createNextFunction = function (iterable) {
    var curIndex, end;
    if (typeof iterable.next === 'function') {
      return function () {
        return iterable.next();
      };
    } else if (iterable instanceof Array) {
      if (Object.isFrozen) {
        if (!Object.isFrozen(iterable)) {
          console.log('IteratorMixin: it is good practice to freeze your array before processing items asynchronously.');
        }
      }
      curIndex = -1;
      end = iterable.length;
      return function () {
        curIndex += 1;
        if (curIndex < end) {
          return iterable[curIndex];
        } else {
          throw 'STOP';
        }
      };
    } else {
      console.log(this);
      throw new Error('"this" is not iterable. It should be an instance of Array, or an object which implements .next()');
    }
  };

  /**
   *
   * helper function. iterates over each element in the iterator.
   *
   * @param callback
   * @param options optional parameters
   * @param [options.maxN] maximum number of iterations per tick
   * @param [options.maxIterationTime] maximum time spent per tick. Default is 10ms. This is an approximate value.
   * @param [options.requestTick] function accepting single function parameter callback. Invoke the callback when a new tick process may be handled.
   *
   */
  var _forEachAsync = function (callback, options) {

    options = options || $N;

    var returnPromise = new Promise();

    var timeDelta, measureTime;
    if (typeof options.maxIterationTime === 'number' && options.maxIterationTime >= 0) {
      timeDelta = options.maxIterationTime;
      measureTime = true;
    } else {
      measureTime = false;
    }

    var maxn = (options.maxN > 0) ? options.maxN : Infinity;
    var requestTick = (typeof options.requestTick === 'function') ? options.requestTick : timeoutTicker;

    var hasMoreElements = true;
    var next = createNextFunction(this);

    var batchCalls = function () {

      var to, nextElement;
      var n = 0;

      if (measureTime) {//only measure time when required. otherwise, skip the check since it is somewhat intrusive)
        to = now() + timeDelta;
      }

      while (
        (!measureTime || (now() < to)) && //still has some time left to process
          (n < maxn) && //still has not reached the maximum element limit
          hasMoreElements //still has elements in the iteration
        ) {

        try {
          nextElement = next();
        } catch (e) {
          hasMoreElements = false;
        } finally {
          if (hasMoreElements) {
            callback(nextElement);
            returnPromise.progress(nextElement);
            n += 1;
          }
        }
      }

      if (hasMoreElements) {//schedule new batch
        requestTick(batchCalls);
      } else {//resolve, because all elements have been processed.
        returnPromise.resolve();
      }

    };
    requestTick(batchCalls);

    return returnPromise.thenable();
  };

  /**
   * @example
   * //Use it like this
   *
   * define([
   *  'path/to/IteratorMixin'
   * ], function(IteratorMixin){
     *
     *  //an iterator must implement next.
     *  var iterator = {
     *    next: function(){
     *      ... return the next element of the iteration or throw an error when the end has been reached ...
     *    }
     *  };
     *
     *  //extend the iterator with the utility funcs. (use IteratorMixin.augment(object)).
     *  IteratorMixin.augment(iterator);
     *  iterator
     *    .mapAsync(function(){
     *      //transform each element
     *    });
     *    .then(function(resultCollection){
     *      //do something with the resultCollection
     *    });
     *
     *  //alternatively, you can call the functions directly in the iterator context
     *  IteratorMixin.mapAsync.call(
     *        iterator,
     *        .mapAsync(function(){
     *          //transform each element
     *        });
     *        .then(function(resultCollection){
     *          //do something with the mapped collection
     *        });
     *
     * //all funcionality is also present as simple functions
     * //!!be aware that this funcion has a side-effect: namely it will exhaust the iterator!
     * //e.g.
     *  IteratorMixin
     *  .mapAsync(myIterator,someMapFunction);
     *
     *
     *
     *});
   */
  function IteratorMixin() {
  }

  IteratorMixin.prototype = {

    groupAsync: function (generateKey, options) {
      var group = {};

      return _forEachAsync
        .call(this,
        function (item) {
          var key = generateKey(item);
          var items = group[key];
          if (items === undefined) {
            items = [];
            group[key] = items;
          }
          items.push(item);
        }, options)
        .then(function () {
          return group;
        });
    },

    mapAsync: function (mapFunction, options) {
      var out = [];
      return _forEachAsync.call(
        this,
        function (value) {
          out.push(mapFunction(value));
        }, options)
        .then(function () {
          return out;
        }, propagateError)
        .thenable();
    },

    filterAsync: function (predicate, options) {
      var out = [];
      return _forEachAsync.call(
        this,
        function (value) {
          if (predicate(value)) {
            out.push(value);
          }
        },
        options)
        .then(function () {
          return out;
        }, propagateError)
        .thenable();
    },

    reduceAsync: function (fold, value, options) {

      if (value === undefined) {
        throw new Error('Cannot reduce empty iterator with no initial value');
      }

      return _forEachAsync
        .call(this, function (next) {
          value = fold(value, next);
        }, options)
        .then(function () {
          return value;
        }, propagateError)
        .thenable();
    }
  };

  IteratorMixin.augment = function (destination) {
    var key;
    for (key in IteratorMixin.prototype) {
      if (IteratorMixin.prototype.hasOwnProperty(key)) {
        destination[key] = IteratorMixin.prototype[key];
      }
    }
    return destination;
  };
  IteratorMixin.extend = IteratorMixin.mixin = IteratorMixin.augment;

  //for convenience, also provide the functionality as properties on the constructor function.
  for (var key in IteratorMixin.prototype) {
    if (IteratorMixin.prototype.hasOwnProperty(key)) {
      (function (method) {
        IteratorMixin[method] = function (iterable) {
          var args = Array.prototype.slice.call(arguments, 1);
          return IteratorMixin.prototype[method].apply(iterable, args);
        };
      }(key));
    }
  }

  //prevent tampering with module.
  if (Object.freeze) {
    Object.freeze(IteratorMixin.prototype);
    Object.freeze(IteratorMixin);
  }

  return IteratorMixin;

});