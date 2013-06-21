if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define([], function() {

  "use strict";

  var ITEMS_PER_LISTENER = 4;
  var CONTINUATION_PROMISE_OFFSET = 3;
  var PROGRESS_HANDLER_OFFSET = 2;
  var REJECT_HANDLER_OFFSET = 1;
  var RESOLVE_HANDLER_OFFSET = 0;
  var NOOP = function() {
  };
  var IDENTITY = function(a) {
    return a;
  };
  var seal = Object.seal || NOOP;
  var freeze = Object.freeze || NOOP;
  var $N = {};
  var resolveMessage = function(data, handler) {
    handler.resolve(data);
  };

  /**
   * Create promise
   * @constructor
   */
  function Promise() {
    this._resolved = false;
    this._rejected = false;
    this._listeners = null;//will lazily initialize.
    this._resolution = null;
    this._error = null;
    seal(this);
  }

  /**
   * transparently handle a promise or a value.
   * @param promiseOrValue
   * @param successHandler
   * @param errorHandler
   * @param progressHandler
   * @return {*}
   */
  Promise.when = function(promiseOrValue, successHandler, errorHandler, progressHandler) {
    var p, res;
    if (typeof promiseOrValue === 'object' && typeof promiseOrValue.then === 'function') {
      return promiseOrValue.then(successHandler, errorHandler, progressHandler);
    } else {
      p = new Promise();
      res = p.then(successHandler, errorHandler);
      setTimeout(function() {
        p.resolve(promiseOrValue);
      }, 0);
      return res;
    }
  };

  Promise._whenError = function(v, errorHandler) {
    if (typeof v.then === 'function') {
      return v.then(NOOP, errorHandler);
    } else {
      var p = new Promise();
      var res = p.then(NOOP, errorHandler);
      setTimeout(function() {
        p.reject(v);
      }, 0);
      return res;
    }
  };

  Promise.promisifyWebWorker = function(workerFile, options) {

    if (!Worker) {
      throw new Error('Web Workers not supported');
    }

    options = options || $N;

    var handleReceivedMessage = options.handleReceivedMessage || resolveMessage;
    var worker = new Worker(workerFile);
    var mapArguments = options.mapArguments || IDENTITY;

    var busy = false;
    var requestQueue = [];
    var inFlightHandler;

    var onMessage = function(arg) {
      if (busy) {
        handleReceivedMessage(arg.data, inFlightHandler);
      }
    };

    function tryNext() {
      if (busy) {
        //must wait until we can send stuff to the worker.
        return;
      }
      if (requestQueue.length === 0) {
        //queue is empty, so cannot do next.
        return;
      }
      var task = requestQueue.shift();
      var promise = task.p;
      inFlightHandler = {
        resolve: function(a) {
          promise.resolve(a);
          busy = false;
          tryNext();
        },
        reject: function(a) {
          promise.reject(a);
          busy = false;
          tryNext();
        },
        progress: function(e) {
          promise.progress(e);
        }
      };

      var message = mapArguments.apply(null, task.args);
      busy = true;
      worker.postMessage(message);
    }

    var promisableWorker = function() {
      var resultPromise = new Promise();
      if (arguments.length === 0) {
        throw new Error('THIS IS BAD!!!!');
      }
      requestQueue.push({
        p: resultPromise,
        args: arguments
      });
      tryNext();
      return resultPromise;
    };

    var initialized;
    if (typeof options.initialize === 'function') {
      initialized = options.initialize(worker);
      return Promise.when(initialized,
          function() {
            //subscribe to onMessage when done, and then return the new function.
            worker.addEventListener('message', onMessage);
            return promisableWorker;
          });
    } else {
      worker.addEventListener('message', onMessage);
      return promisableWorker;
    }

  };

  Promise.prototype = {
    __propagate: function(offset, value) {
      var listeners = this._listeners;
      if (listeners === null){
        return;
      }
      var i, l, listener, continuation, ret;
      for (i = 0, l = listeners.length; i < l; i += ITEMS_PER_LISTENER) {
        listener = listeners[i + offset];
        continuation = listeners[i + CONTINUATION_PROMISE_OFFSET];
        try {
          ret = listener(value);
          if (typeof ret.then === 'function') {
            ret.then(
                function(e) {
                  continuation.resolve(e);
                },
                function(e) {
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
    thenable: function() {
      var self = this;
      return {
        then: function(onResolve, onReject, onProgress) {
          return self.then(onResolve, onReject, onProgress);
        }
      };
    },

    then: function(onResolve, onReject, onProgress) {

      var index;
      var continuationPromise = new Promise();

      onReject = onReject || NOOP;
      onProgress = onProgress || NOOP;

      if (this._resolved) {
        return Promise.when(this._resolution, onResolve, onReject);
      } else if (this._rejected) {
        return Promise._whenError(this._error, onReject);
      } else {
        if (this._listeners === null){
          this._listeners = [];
        }
        index = this._listeners.length;
        this._listeners[index + RESOLVE_HANDLER_OFFSET] = onResolve;
        this._listeners[index + REJECT_HANDLER_OFFSET] = onReject;
        this._listeners[index + PROGRESS_HANDLER_OFFSET] = onProgress;
        this._listeners[index + CONTINUATION_PROMISE_OFFSET] = continuationPromise;
      }

      return continuationPromise;

    },
    __breakIfComplete: function() {
      if (this._resolved) {
        throw new Error('This promise has already been resolved.');
      } else if (this._rejected) {
        throw new Error('This promise has already been rejected.');
      }
    },
    progress: function(intermediateValue) {
      this.__breakIfComplete();
      var i, l, listener;
      for (i = PROGRESS_HANDLER_OFFSET, l = this._listeners.length; i < l; i += ITEMS_PER_LISTENER) {
        listener = this._listeners[i];
        listener(intermediateValue);
      }
    },
    resolve: function(resolution) {
      this.__breakIfComplete();
      this._resolved = true;
      this._resolution = resolution;
      this.__propagate(RESOLVE_HANDLER_OFFSET, resolution);
    },
    reject: function(rejection) {
      this.__breakIfComplete();
      this._rejected = true;
      this._error = rejection;
      this.__propagate(REJECT_HANDLER_OFFSET, rejection);
    }
  };

  freeze(Promise.prototype);
  freeze(Promise);

  return Promise;

});