onmessage = function(event) {

  var value = event.data;
  var s = value.split(' ');
  var map = {};

  setTimeout(function(){
    for (var i in s) {
      if (!map[s[i]]) {
        map[s[i]] = 0;
      }
      map[s[i]] += 1;
    }
    postMessage(map);
  },10);

};



