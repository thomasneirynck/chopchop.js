define([], function () {

  "use strict";

  var ITEMS_PER_LISTENER = 4;
  var CONTINUATION_PROMISE_OFFSET = 3;
  var PROGRESS_HANDLER_OFFSET = 2;
  var REJECT_HANDLER_OFFSET = 1;
  var RESOLVE_HANDLER_OFFSET = 0;
  var NOOP = function () {
  };
  var seal = Object.seal || NOOP;
  var freeze = Object.freeze || NOOP;

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
  Promise.when = function (promiseOrValue, successHandler, errorHandler, progressHandler) {
    if (promiseOrValue && typeof promiseOrValue.then === 'function') {
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
    if (v && typeof v.then === 'function') {
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

      return continuationPromise.thenable();

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

  freeze(Promise.prototype);
  freeze(Promise);

  return Promise;

});