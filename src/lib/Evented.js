if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define([], function () {

  function Evented() {
    this.__evntdCallbacks = {};
  }

  Evented.prototype = {
    emit: function (eventName, event) {
      var onHandler, i, l;
      //notify listeners registered with 'on'
      var listeners = this.__evntdCallbacks[eventName];
      if (listeners) {
        for (i = 0, l = listeners.length; i < l; i++) {
          listeners[i](event);
        }
      }
      //notify listener at this.oneventName (if any)
      onHandler = this['on' + eventName];
      if (onHandler) {
        onHandler.call(this, event);
      }
    },
    on: function (eventName, callback) {
      var listeners = this.__evntdCallbacks[eventName];
      if (!listeners) {
        listeners = [];
        this.__evntdCallbacks[eventName] = listeners;
      }
      listeners[listeners.length] = callback;
      return {
        remove: function () {
          var index = listeners.indexOf(callback);
          listeners.splice(index, 1);
        }
      };
    }
  };

  Evented.augment = function (ob) {
    for (var i in Evented.prototype) {
      ob[i] = Evented.prototype[i];
    }
    return ob;
  };

  if (Object.freeze) {
    Object.freeze(Evented);
    Object.freeze(Evented.prototype);
  }

  return Evented;

});