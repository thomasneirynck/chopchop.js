define([
  'lib/IterableMixin'
], function (IterableMixin) {

  module("IterableMixin");

  var array = [];
  var elementCount = 16;
  var counter = elementCount;
  while (counter--) array.unshift(counter);

  function TestIterable() {
    this._i = 0;
  }

  TestIterable.prototype = {
    _a: array,
    next: function () {
      if (this._i >= this._a.length) {
        throw 'Stop!';
      }
      var val = this._a[this._i];
      this._i += 1;
      return val;
    }
  };


  IterableMixin.extend(TestIterable.prototype);

  test("module return", function () {
    ok(typeof IterableMixin === 'function', "should get function from module");
  });


  asyncTest("forEachAsync- all in one", function () {

    var it = new TestIterable();

    var tickIndex = 0;
    var firsttime;
    var ticks = 0;

    var counter = 0;
    var promise = it.mapAsync(function (value) {
      if (counter === 0) {
        firsttime = tickIndex;
      } else {
        equal(firsttime, tickIndex, "must be called in same tick, always");
      }
      counter += 1;
      return 'ignore';
    }, {
      maxIterationTime: Infinity,
      maxN: Infinity,
      requestTick: function (cb) {
        ticks += 1;
        setTimeout(cb, 0);
      }
    });


    promise.then(function () {
      equal(counter, elementCount, "must be called same times");
      equal(ticks, 1, 'must only be called once');
      start();
    });

    ok(typeof promise.then === 'function', "must get thennable");

  });

  asyncTest("mapAsync- one by one", function () {

    var it = new TestIterable();
    var counter = 0;
    var lastTick = 0;

    var promise = it.mapAsync(function (a) {
      return a * 10;
    }, {
      maxIterationTime: Infinity,
      maxN: 1,
      requestTick: function (callback) {
        lastTick += 1;
        counter += 1;
        setTimeout(callback, 0);
      }
    });

    promise
      .then(function () {
        equal(counter, elementCount + 1, "must be called same times");
        start();
      });

    ok(typeof promise.then === 'function', "must get thennable");

  });

  asyncTest("mapAsync", function () {

    var it = new TestIterable();

    var promise = it.mapAsync(function (e) {
      return e + 1000;
    }).then(function (e) {
        equal(e.length, elementCount, "should get array with equal number of elem");
        e.forEach(function (val, i) {
          equal(val - 1000, it._a[i]);
        });
        start();
      });
    ok(typeof promise.then === 'function', "must get thennable");
  });

  asyncTest("mapAsync - array", function () {

    var ar = Object.freeze([1, 2, 3, 4, 5]);

    var promise = IterableMixin.mapAsync(ar,function (e) {
      return e + 1000;
    }).then(function (e) {
        equal(e.length, ar.length, "should get array with equal number of elem");
        e.forEach(function (val, i) {
          equal(val - 1000, ar[i]);
        });
        start();
      });
    ok(typeof promise.then === 'function', "must get thennable");
  });

  asyncTest("filterAsync", function () {

    var it = new TestIterable();

    var promise = it.filterAsync(function (e) {
      return (e % 2 === 0);
    }).then(function (e) {
        equal(e.length, Math.floor(elementCount / 2), "should get array with half number of elem");
        e.forEach(function (val) {
          ok(val % 2 === 0);
        });
        start();
      });
    ok(typeof promise.then === 'function', "must get thennable");
  });

  asyncTest("reduceAsync", function () {

    var it = Object.create(new TestIterable());

    var promise = it.reduceAsync(function (a, b) {
      return a + b;
    }, 0).then(function (e) {
        equal(e, 120, "should have reduced");
        start();
      });
    ok(typeof promise.then === 'function', "must get thennable");
  });

  asyncTest("reduceAsync  - empty with initial", function () {

    var it = {
      next: function () {
        throw 'asdf';
      }
    };
    IterableMixin.extend(it);

    var promise = it.reduceAsync(function (a, b) {
      return a + b;
    }, 1).then(function (e) {
        equal(e, 1, "should have reduced");
        start();
      });
  });


  asyncTest("map - requestTick", function () {

    var a = 0;

    function ticker(callback) {
      //requested tick
      a += 1;
      setTimeout(callback, 0);
    }

    var it = Object.create(new TestIterable());
    it
      .mapAsync(function () {
        return 'ignore';
      }, {
        requestTick: ticker,
        maxN: 1
      })
      .then(function () {
        equal(a - 1, elementCount, 'should have used ticker');
        start();
      });

  });

  asyncTest("reduce - cyber", function () {

    var it = {
      _i: -1,
      _l: 10000,
      next: function () {
        this._i += 1;
        if (this._i < this._l) {
          return this._i;
        } else {
          throw 'stop!';
        }
      }
    };

    IterableMixin.augment(it);


    it.reduceCyber(
      function (acc, a) {
        var to = Date.now() + 2;
        while (Date.now() < to);
        return acc + a;
      }, 0, {
        targetTime: 16,
        n: 20
      })
      .then(function () {
        ok(true);
        start();
      });

//    it2 = Object.create(it);
//    it2.reduceCyber(
//      function (acc, a) {
//        var to = Date.now() + 2;
//        while (Date.now() < to);
//        return acc + a;
//      }, 0, {
//        targetTime: 16,
//        n: 20
//      })
//      .then(function () {
//        ok(true);
//        start();
//      });
//
//    it3 = Object.create(it);
//    it3.reduceCyber(
//      function (acc, a) {
//        var to = Date.now() + 2;
//        while (Date.now() < to);
//        return acc + a;
//      }, 0, {
//        targetTime: 16,
//        n: 20
//      })
//      .then(function () {
//        ok(true);
//        start();
//      });
//
//    it4 = Object.create(it);
//    it4.reduceCyber(
//      function (acc, a) {
//        var to = Date.now() + 2;
//        while (Date.now() < to);
//        return acc + a;
//      }, 0, {
//        targetTime: 16,
//        n: 20
//      })
//      .then(function () {
//        ok(true);
//        start();
//      });
//
//    it5 = Object.create(it);
//    it5.reduceCyber(
//      function (acc, a) {
//        var to = Date.now() + 2;
//        while (Date.now() < to);
//        return acc + a;
//      }, 0, {
//        targetTime: 16,
//        n: 20
//      })
//      .then(function () {
//        ok(true);
//        start();
//      });

  });


});

