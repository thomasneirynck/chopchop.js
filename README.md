#chopchop.js#

A small javascript utility library for (quickly) processing of asynchronous collections.

Currently only contains two modules:

1. Promise: lightweight PromiseA implementationand
2. IterableMixin: a mixin with asynchronous array comprehension methods for iterables. It works with arrays or iterators.


##IterableMixin##
A mixin for iterators, specifically designed for asynchronous collection comprehension. Supports basic  map, filter, reduce and groupBy functionality.

It works with arrays (the native JS Array) and iterators (any object which implements .next()).

It is particularly useful for applications which need to keep the UI responsive
or to prevent stop-script errors when performing long running computation in loops (e.g. games, visualization software).

The general idea is that elements from the collection (represented by the Array or iterator) are processed in small batch.

You can configure this process (for example, set a time-limit on the duration of a batch, or a limit on the maximum number of elements that can be processed).

All methods use thenables (CommonJS PromiseA) to represent the asynchronous values.

Once, you have an iterator, you can use <code>.augment().</augment> to extend it with the functionality.

    define([
        'path/to/IteratorMixin'
    ], function(IteratorMixin){

        //an iterator must implement next.
        var iterator = {
            next: function(){
                ... return the next element of the iteration or throw an error when the end has been reached ...
            }
        };

        IteratorMixin.augment(iterator);
    });

Below is an example of an iterator for an array. Note that you get this for free since all methods work
both with arrays and iterators alike. But it is a good real-life example of how you could implement an Iterator.

    function ArrayIterator(array){
        this._a = array;
        this._current = 0;
    }
    ArrayIterator.prototype = {
        next: function(){
            if (this._current >= this._a.length){
                throw 'Stop!';
            }
            var nextElement = this._a[this._current];
            this._current += 1;
            return nextElement;
        }
    }

    arrayIterator = new ArrayIterator([1,2,3,4]);
    arrayIterator.next();//is 1
    arrayIterator.next();//is 2
    arrayIterator.next();//is 3
    arrayIterator.next();//is 4
    arrayIterator.next();//throw stop error



###Asynchronous collection comprehension###

Use any of the asynchronous methods to process elements of the iterator in small increments.

The return is a thenable (see CommonJS - Promise/A)[http://wiki.commonjs.org/wiki/Promises/A]

A thenable has a then-method, which takes 3 parameters, all of them functions:

1. a callback handle for when the end thenable has resolved,
2. an error handle
3. a progress handle.


####mapAsync####

Takes a single map function as parameter.

Returns a promise for a new collection, which contains all mapped items.

    function map(item){
        var mappedItem =
            ...
            map item into a new value
            ...
        return mappedItem;
    }

    iterator
       .mapAsync(map)
       .then(function successHandler(mappedCollection){
            //mappedCollection is an Array where each element
            //is the result of the map function
            //applied to an element of the iterator.
        });

####reduceAsync####

Reduce all elements from an iterator to a single value. This takes two parameters:

1. a function which combines the current
2. an initial value


       function sum(a,b){
            return a + b;
       }

       iterator
        .reduceAsync(sum,0)
        .then(function(total){
            console.log("total: " + total);
        });

####filterAsync####

Takes a single predicate function and returns a new array which only contains the elements which passes the filter function.

        function equalToOne(item){
            return item === 1;
        }

        iterator
            .filterAsync(equalToOne)
            .then(function(array){
                console.log('every element in this array equals 1: ', array);
            });


####groupByAsync####

Takes a single hash-fuctions, and groups all elements in a map where the key is the hash, and the

           function sign(n){
                if (n < 0){
                    return 'negative';
                }else if (n === 0){
                    return 'zero';
                }else{
                    return 'positive';
                }
           }

           iterator
                .groupByAsync(sign)
                .then(function(map){
                    //map is an POJSO (plain-old JS object)
                    //where the key is eith
                    //and the value is an array of the elements that
                });


###Controlling the duration of the iteration###

All Async method (mapAsync, reduceAsync, filterAsync, groupByAsync) can take an optional options object as a last parameter.

This object can have 3 optional properties:

1. maxIterationTime: a number
2. maxN: an integer specifying how many items may maximally be processed in a single time-step.
3. requestTick: a function taking a single parameter which is a callback function. This function invokes the callback when a next iteration of the can be performed.

####maxIterationTime###

Specify the maximum duration - in milliseconds - of a single tick. The duraction is approximate, and actual computation in a single callstack
might exceed this value.

    iterator.forEachAsync(function(item){
        console.log("item: ",item);
    },{
        maxIterationTime: 20
    };

####maxN####

Process no more than n elements in a single tick.

     iterator.forEachAsync(function(item){
            console.log("item: ",item);
        },{
            maxIterationTime: 20
        };


####requestTick####

A function which invokes a callback. Only elements from the iterator will be processed when the callback function has been called.

    function onAnimationFrame(callback){
        mozRequestAnimationFrame(callback);//only for Mozilla browsers
    }

    iterator.forEachAsync(function(item){
            console.log("item: ",item);
        },{
            requestTick: onAnimationFrame
        };


##Promise.js##


A vanilla PromiseA, supporting resolve, reject, progress.

It has a convenient .thenable

###.thenable###

define(['path/to/Promise'],function(Promise){


    //'promise' has the resolve/reject/progress methods. hold on to this one!
    var promise = new Promise();

    //'thenable' only has a .then subscription method, but not the resolve/reject/progress methods
    //Give this one to the users of your API.
    //it is linked - by quantum entanglement presumably - to the promise which generated it.
    var thenable = promise.thenable();


});



##The code##

Download the AMD modules here: (IteratorMixin.js)[./src/lib/]

Find QUnit tests (here)[./testsrc/lib/index.html]


