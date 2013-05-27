if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define([], function () {
  "use strict";

  var Promise = (function () {

    var ITEMS_PER_LISTENER = 4;
    var CONTINUATION_PROMISE_OFFSET = 3;
    var PROGRESS_HANDLER_OFFSET = 2;
    var REJECT_HANDLER_OFFSET = 1;
    var RESOLVE_HANDLER_OFFSET = 0;
    var NOOP = function () {
    };

    /**
     * Create promise
     * @constructor
     */
    function Promise() {
      this._resolved = false;
      this._rejected = false;
      this._listeners = [];
      this._resolution = null;
      this._error = null;
    }

    /**
     * transparently handle a promise or a value.
     * @param promiseOrValue
     * @param successHandler
     * @param errorHandler
     * @param progressHandler
     * @return {*}
     */
    Promise.when = function (promiseOrValue, successHandler, errorHandler, progressHandler) {
      if (typeof promiseOrValue === 'object' && typeof promiseOrValue.then === 'function') {
        return promiseOrValue.then(successHandler, errorHandler, progressHandler);
      } else {
        var p = new Promise();
        var res = p.then(successHandler, errorHandler);
        setTimeout(function () {
          p.resolve(promiseOrValue);
        }, 0);
        return res;
      }
    };

    Promise._whenError = function (v, errorHandler) {
      if (typeof v.then === 'function') {
        return v.then(NOOP, errorHandler);
      } else {
        var p = new Promise();
        var res = p.then(NOOP, errorHandler);
        setTimeout(function () {
          p.reject(v);
        }, 0);
        return res;
      }
    };

    Promise.prototype = {
      __propagate: function (offset, value) {
        var listeners = this._listeners;
        var i, l, listener, continuation, ret;
        for (i = 0, l = listeners.length; i < l; i += ITEMS_PER_LISTENER) {
          listener = listeners[i + offset];
          continuation = listeners[i + CONTINUATION_PROMISE_OFFSET];
          try {
            ret = listener(value);
            if (typeof ret.then === 'function') {
              ret.then(
                function (e) {
                  continuation.resolve(e);
                },
                function (e) {
                  continuation.reject(e);
                }
              );
            } else {
              continuation.resolve(ret);
            }
          } catch (e) {
            //error in propagation, so reject the continuation.
            continuation.reject(e);
          }
        }
      },
      /**
       * create a thenable from this promise.
       *  A thenable is an object with only a 'then' subscription function.
       *  It is useful to pass around to potential users of a promise you have created. These users cannot tamper with the promise to which
       *  the thenable is bound. (E.g. they cannot resolve the thenable, only listen to when it will be resolved).
       * @return {Object} thenable
       */
      thenable: function () {
        var self = this;
        return {
          then: function (onResolve, onReject, onProgress) {
            return self.then(onResolve, onReject, onProgress);
          }
        };
      },

      then: function (onResolve, onReject, onProgress) {

        var index;
        var continuationPromise = new Promise();

        onReject = onReject || NOOP;
        onProgress = onProgress || NOOP;

        if (this._resolved) {
          return Promise.when(this._resolution, onResolve, onReject);
        } else if (this._rejected) {
          return Promise._whenError(this._error, onReject);
        } else {
          index = this._listeners.length;
          this._listeners[index + RESOLVE_HANDLER_OFFSET] = onResolve;
          this._listeners[index + REJECT_HANDLER_OFFSET] = onReject;
          this._listeners[index + PROGRESS_HANDLER_OFFSET] = onProgress;
          this._listeners[index + CONTINUATION_PROMISE_OFFSET] = continuationPromise;
        }

        return continuationPromise;

      },
      progress: function (intermediateValue) {
        this.__breakIfComplete();
        var i, l, listener;
        for (i = PROGRESS_HANDLER_OFFSET, l = this._listeners.length; i < l; i += ITEMS_PER_LISTENER) {
          listener = this._listeners[i];
          listener(intermediateValue);
        }
      },
      __breakIfComplete: function () {
        if (this._resolved) {
          throw new Error('This promise has already been resolved.');
        } else if (this._rejected) {
          throw new Error('This promise has already been rejected.');
        }
      },
      resolve: function (resolution) {
        this.__breakIfComplete();
        this._resolved = true;
        this._resolution = resolution;
        this.__propagate(RESOLVE_HANDLER_OFFSET, resolution);
      },
      reject: function (rejection) {
        this.__breakIfComplete();
        this._rejected = true;
        this._error = rejection;
        this.__propagate(REJECT_HANDLER_OFFSET, rejection);
      }
    };

    return Promise;

  }());

  /**
   * main module.
   * the return is a mixin object
   */
  return (function () {

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
     *  //extend the iterator with the utility funcs. (use IteratorMixin.extend, or dojo.mixin,...)
     *  IteratorMixin.extend(iterator);
     *  iterator
     *    .mapAsync(function(){
     *      //transform each element
     *    });
     *    .then(function(resultCollection){
     *      //do something with the mapped collection
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

    IteratorMixin.extend = function (destination) {
      var key;
      for (key in IteratorMixin.prototype) {
        if (IteratorMixin.prototype.hasOwnProperty(key)) {
          destination[key] = IteratorMixin.prototype[key];
        }
      }
      return destination;
    };

    //for convenience, also provide the functionality as static functions on the constructor function.
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

    if (Object.freeze) {
      Object.freeze(IteratorMixin.prototype);
      Object.freeze(IteratorMixin);
    }

    return IteratorMixin;

  }());

});