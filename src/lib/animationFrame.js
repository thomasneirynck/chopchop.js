if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(['./Promise'], function (Promise) {

  var moduleReturn, requestAnimationFrame, cancelAnimationFrame;
  var lastTime, callbackQueue, now, shimIdCounter, idQueue, timeoutId, callbackBuffer;

  //first, try vendor specific implementations.
  (function () {
    var vendors = ['ms', 'moz', 'webkit', 'o'], x;
    for (x = 0; x < vendors.length && !requestAnimationFrame; x += 1) {
      requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
      cancelAnimationFrame = window[vendors[x] + 'CancelRequestAnimationFrame'] || window[vendors[x] + 'CancelAnimationFrame'];

      //native implementations should be called in window context (otherwise might get IllegalInvocation errors)
      if (requestAnimationFrame) {
        requestAnimationFrame = requestAnimationFrame.bind(window);
      }
      if (cancelAnimationFrame) {
        cancelAnimationFrame = cancelAnimationFrame.bind(window);
      }
    }
  }());

  function getQueryParams(qs) {
    //ates goral,
    //retrieved from http://stackoverflow.com/questions/979975/how-to-get-the-value-from-url-parameter
    //on, 2/28/2013
    qs = qs.split("+").join(" ");
    var params = {};
    var re = /[?&]?([^=]+)=([^&]*)/g;
    var tokens;
    while (tokens = re.exec(qs)) {
      params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
    }
    return params;
  }

  now = Date.now || function () {
    return new Date().getTime();
  };

  //if no native implementations, shim the implementation
  if (!requestAnimationFrame || !cancelAnimationFrame) {

    //initialize state.
    lastTime = -Infinity;
    timeoutId = null;
    callbackQueue = [];
    callbackBuffer = [];
    idQueue = [];
    shimIdCounter = 0;

    //callback function on setTimeout
    //define it here instead of as a more typical anonymous function inside the requestAnimationFrame body.
    //FWIW, the advantage is that no new closure is created inside requestAnimationFrame
    var callListeners = function () {

      var i, l;

      timeoutId = null;
      lastTime = now();

      //update call queues
      //if we do not copy all callbacks requestAnimationFrame is not re-entrant (because frame request can - and often are - made recursively).
      //manual copy is more verbose than Array.prototype.slice(), but it allocates no new memory
      l = callbackQueue.length;
      callbackBuffer.length = 0;
      for (i = 0; i < l; i += 1) {
        callbackBuffer[i] = callbackQueue[i];
      }
      callbackQueue.length = 0;
      idQueue.length = 0;

      for (i = 0; i < l; i += 1) {
        callbackBuffer[i](lastTime);
      }
    };

    //shim RAF
    requestAnimationFrame = function (callback) {
      var shimIdCb = shimIdCounter;
      shimIdCounter += 1;
      callbackQueue[callbackQueue.length] = callback;
      idQueue[idQueue.length] = shimIdCb;
      if (timeoutId === null) {
        timeoutId = setTimeout(callListeners, Math.max(0, 16 - (now() - lastTime)));
      }
      return shimIdCb;
    };

    //shim CAF
    cancelAnimationFrame = function (id) {
      var index = idQueue.indexOf(id);
      if (index >= 0) {
        callbackQueue.splice(index, 1);
        idQueue.splice(index, 1);
      }
    };
  }


  var query = getQueryParams(document.location.search);

  //if fps=show is a query-param in the URL, show a frame-per-second line-chart
  if (query.fps === 'show') {

    requestAnimationFrame = (function () {

      var width = parseInt(query.fps_w) || 256;
      var height = parseInt(query.fps_h) || 128;
      var targetFrameTime = parseInt(query.fps_frameref) || 16;
      var maxFrameTime = parseInt(query.fps_framemax) || 80;

      var averageComp = (parseInt(query.fps_average) || 90) / 100;
      var frameComp = 1 - averageComp;

      var oldRAF = requestAnimationFrame;
      var frameId = -1;
      var frameDuration = 0;
      var frameDurations = [];
      frameDurations.length = width;

      var i, l;
      for (i = 0, l = frameDurations.length; i < l; i += 1) {
        frameDurations[i] = 0;
      }
      var index = 0;
      var averageTime = 0;


      var canv = document.createElement('canvas');
      canv.width = width;
      canv.height = height;
      canv.style.position = 'absolute';
      canv.style.top = '0px';
      canv.style.left = '0px';
      canv.style.border = '1px solid black';
      var context = canv.getContext('2d');
      document.body.appendChild(canv);

      var x_scale = height / maxFrameTime;
      var y_scale = width / frameDurations.length;

      function addSample(duration) {
        frameDurations[index] = duration;
        index += 1;
        index = index % frameDurations.length;//wrap around
        averageTime = (averageComp * averageTime) + (frameComp * duration);
        averageTime = Math.round(averageTime);
      }

      function drawGraph() {

        context.restore();
        context.clearRect(0, 0, width, height);
        context.fillStyle = 'rgba(139,137,137,1)';
        context.fillRect(0, 0, width, height);
        context.save();

        context.translate(0, height);
        context.scale(y_scale, -x_scale);


        context.strokeStyle = "rgba(255, 255, 255, 0.4)";
        context.lineWidth = 0.3;
        var i;
        for (i = 0; i <= maxFrameTime; i += 10) {
          context.beginPath();
          context.moveTo(0, i);
          context.lineTo(width, i);
          context.stroke();
        }

        context.strokeStyle = "rgb(233,124,12)";
        context.lineWidth = 0.8;
        context.beginPath();
        context.moveTo(0, targetFrameTime);
        context.lineTo(width, targetFrameTime);
        context.stroke();

        context.strokeStyle = "rgb(0, 255, 0)";
        context.beginPath();
        context.moveTo(0, frameDurations[0]);
        var end = frameDurations.length;
        for (i = 1; i < end; i++) {
          var ind = (i + index) % end;
          var frameTime = frameDurations[ind];
          context.lineTo(i, frameTime);
        }
        context.stroke();

        context.restore();
        context.fillStyle = 'rgba(255,255,255,1)';
        context.fillText('rt : ' + averageTime, 4, 18);
        context.save();

      }

      function wrappedRAF(callback, node) {
        return oldRAF(function (timestep) {
          if (frameId !== timestep) {
            addSample(frameDuration);
            frameId = timestep;
            frameDuration = 0;
          }
          var before = now();//in
          callback(timestep);
          frameDuration += (now() - before);
          drawGraph();
        }, node);
      }

      wrappedRAF.__calls = frameDurations;
      return wrappedRAF;
    }());
  }

  //return module. freeze to prevent tampering.
  moduleReturn = {
    requestAnimationFrame: requestAnimationFrame,
    cancelAnimationFrame: cancelAnimationFrame,
    promiseAnimationFrame: function () {
      var p = new Promise();
      requestAnimationFrame(function (a) {
        p.resolve(a);
      });
      return p.thenable();
    }
  };

  if (Object.freeze) {
    Object.freeze(moduleReturn);
  }

  return moduleReturn;

});