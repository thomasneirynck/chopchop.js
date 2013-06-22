if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define([], function() {

  function Evented() {
  }

  Evented.prototype = {
    emit: function(eventName, event) {

      var onHandler, i, l,listeners;
      if (typeof this.__evntdCallbacks === 'object') {
        //notify listeners registered with 'on'
        listeners = this.__evntdCallbacks[eventName];
        if (listeners) {
          for (i = 0, l = listeners.length; i < l; i++) {
            listeners[i](event);
          }
        }
      }

      //notify listener at this.oneventName (if any)
      onHandler = this['on' + eventName];
      if (typeof onHandler === 'function') {
        onHandler.call(this, event);
      }
    },
    on: function(eventName, callback) {

      if (this.__evntdCallbacks === undefined || this.__evntdCallbacks === null) {
        this.__evntdCallbacks = {};
      }

      var listeners = this.__evntdCallbacks[eventName];
      if (!listeners) {
        listeners = [];
        this.__evntdCallbacks[eventName] = listeners;
      }
      listeners[listeners.length] = callback;
      return {
        remove: function() {
          var index = listeners.indexOf(callback);
          listeners.splice(index, 1);
        }
      };
    }
  };

  Evented.augment = function(ob) {
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