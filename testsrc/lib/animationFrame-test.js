define([
  'lib/animationFrame'
], function (frame) {

  module("animationFrame");

  test("module return", function () {

    equal(typeof frame.requestAnimationFrame, 'function', "should have request");
    equal(typeof frame.cancelAnimationFrame, 'function', "should have cancel");

  });

  test("request", function () {

    var fr = frame.requestAnimationFrame(function () {
    });
    ok(fr !== undefined, "should get handle");

  });

  asyncTest("request asynx", function () {

    var registeredTime, realtime1, realtime2;
    var handle1 = frame.requestAnimationFrame(function (time) {
      ok(typeof time === 'number', "should get timestamp");
      registeredTime = time;
      var to = new Date().getTime() + 1000;//wait second
      realtime1 = new Date().getTime();
      while (new Date().getTime() < to) {
      }

    });
    var handle2 = frame.requestAnimationFrame(function (time) {
      realtime2 = new Date().getTime();
      equal(registeredTime, time, "time stamps should be same");
      ok(realtime2 > realtime1, "even thoug callback is later, shouldve occurred on same frame");
      start();
    });
  });

  asyncTest("cancel", function () {

    var called = false;
    var handle1 = frame.requestAnimationFrame(function () {
      console.log("cancel!", arguments);
      called = true;
    });
    frame.cancelAnimationFrame(handle1);

    setTimeout(function () {
      ok(!called, "should never have called the frame");
      start();
    }, 1000);//wait 1 second.

  });

});