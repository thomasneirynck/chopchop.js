var init;
onmessage = function(oEvent) {
  setTimeout(function() {
    var d = oEvent.data;
    if (typeof d.init === 'string') {
      postMessage('init done');
      init = d.init;
    } else {
      postMessage('foo ' + oEvent.data + ' ' + init);
    }
  }, Math.round(Math.random() * 1000));
};



