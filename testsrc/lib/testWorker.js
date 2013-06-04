// postMessage("I\'m working before postMessage(\'ali\').");
onmessage = function(oEvent) {
  setTimeout(function() {
    postMessage('foo ' + oEvent.data);
  }, Math.round(Math.random() * 1000));
};



