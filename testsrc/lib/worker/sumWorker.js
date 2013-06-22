onmessage = function(oEvent) {
  var dt = oEvent.data;
  var acc = dt[0];
  var value = dt[1];
  if (acc === undefined) {
    acc = 0;
  }
  acc += value;
  postMessage(acc);
};



