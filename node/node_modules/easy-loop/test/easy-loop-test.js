//var fs = require('fs');
var loop = require('../lib/easy-loop');

/*
var arr = [1,2,3,4,5];
console.log("Case1 Start => Array and 3 arguments");
console.log("Start : Now Second : ", new Date().getSeconds());
loop(arr, function(i, value, next){
	setTimeout(function(){
		console.log(i, "=>", value, " , Date : ", new Date().getSeconds());
		next();	//require	
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case 1 result");
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case1 End => Array");
*/

/*
console.log("Case2 Start => Array and 2 arguments");
loop.for(arr, function(i, value, next){
	setTimeout(function(){
		console.log(i, "=>", value);	
		next();	//require	
	}, 1000);
});
console.log("Case2 End");



console.log("Case3 Start => Array and error(or break) and 3 arguments");
loop.while(arr, function(i, value, next){
	setTimeout(function(){
		console.log(i, "=>", value);
		if(i === 2)	next("error or break");
		else		next();
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case 3 result");
});
console.log("Case3 End");



var obj = {a:1,b:2,c:3,d:4,e:5};
console.log("Case4 Start => Object and 3 arguments");
loop.loop(obj, function(key, value, next){
	setTimeout(function(){
		console.log(key, "=>", value);
		next();
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case 4 result");
});
console.log("Case4 End");






var arr = [];
console.log("Case5 Start => Empty Array and 3 arguments");
loop(arr, function(i, value, next){
	setTimeout(function(){
		console.log(i, "=>", value);
		next();
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case5 result");
});
console.log("Case5 End");






var arr = [];
for(var i=0; i<10000; i++) arr.push(i);
console.log("Case6 Start => concurrency and 4 arguments");
console.log("Start : Now Second : ", new Date().getSeconds());
loop(arr, function(i, value, next){
	setTimeout(function(){
		console.log(i, "=>", value, " , Date : ", new Date().getSeconds());
		next();
	}, 1000);
}, 10000, function(err){
	console.log("err : ", err);
	console.log("Case 6 result");
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case6 End");



var num = 0;
console.log("Case7 Start => while and 3 arguments");
console.log("Start : Now Second : ", new Date().getSeconds());
loop.while(function(){
	return num < 5;
}, function(next){
	setTimeout(function(){
		console.log("Date : ", new Date().getSeconds());
		num++;
		next();
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case 7 result");
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case7 End");





var num = 0;
console.log("Case8 Start => while and 3 arguments and break(or error)");
console.log("Start : Now Second : ", new Date().getSeconds());
loop.while(function(){
	return num < 5;
}, function(next){
	setTimeout(function(){
		console.log("Date : ", new Date().getSeconds());
		num++;
		next(num === 1 ? true : false);
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case 8 result");
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case8 End");
*/

/*
console.log("Case9 Start => When only know the number of iterations. 2 or 3 arguments possible");
console.log("Start : Now Second : ", new Date().getSeconds());
var loopCount = 5;
loop(loopCount, function(i, next){
	setTimeout(function(){
		console.log(i, "Date : ", new Date().getSeconds());
		next();
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case 9 result");
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case9 End");
*/

/*
console.log("Case10 Start => When only know the number of iterations");
console.log("Start : Now Second : ", new Date().getSeconds());
var handle = loop.create(10, function(err){
	console.log("err : ", err);
	console.log("Case 10 result");
	console.log("Result : Now Second : ", new Date().getSeconds());
});
for(var i=0; i<10; i++)
{
	setTimeout(function(){
		console.log("Date : ", new Date().getSeconds());
	  handle.next();
	}, 1000);
}
console.log("Case10 End");
*/



/*
console.log("Case11 Start => Array. Like as 'async.series'. If the error is when to stop.");
console.log("Start : Now Second : ", new Date().getSeconds());
var arr = [
	function(callback){
		console.log("start series");
		callback();
	},
	function(callback){
		setTimeout(function(){
			console.log(100);
			callback(null, 100);
		}, 1000);
	}, 
	function(callback){
		setTimeout(function(){
			console.log(200);
			callback(null, 200);
		}, 1000);
	}
];
loop.series(arr, function(err, results){
	console.log("err : ", err);
	console.log("results : ", JSON.stringify(results));
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case11 End");
*/



/*
console.log("Case12 Start => Object. Like as 'async.series'. If the error is when to stop.");
console.log("Start : Now Second : ", new Date().getSeconds());
var obj = {
	one :	function(callback){
		console.log("start series");
		callback();
	},
	two : function(callback){
		setTimeout(function(){
			console.log(100);
			callback(null, 100);
		}, 1000);
	}, 
	three : function(callback){
		setTimeout(function(){
			console.log(200);
			callback(null, 200);
		}, 500);
	}
};
loop.series(obj, function(err, results){
	console.log("err : ", err);
	console.log("results : ", JSON.stringify(results));
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case12 End");
*/




/*
console.log("Case13 Start => Array. Like as 'async.parallel'. If the error is when to stop.");
console.log("Start : Now Second : ", new Date().getSeconds());
var arr = [
	function(callback){
		console.log("start parallel");
		callback();
	},
	function(callback){
		setTimeout(function(){
			console.log(100);
			callback(null, 100);
		}, 500);
	}, function(callback){
		setTimeout(function(){
			console.log(200);
			callback(null, 200);
		}, 500);
	}
];
loop.parallel(arr, function(err, results){
	console.log("err : ", err);
	console.log("results : ", JSON.stringify(results));
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case13 End");
*/


/*
console.log("Case14 Start => Object. Like as 'async.parallel'. If the error is when to stop.");
console.log("Start : Now Second : ", new Date().getSeconds());
var obj = {
	one :	function(callback){
		console.log("start parallel");
		callback();
	},
	two : function(callback){
		setTimeout(function(){
			console.log(100);
			callback(null, 100);
		}, 500);
	}, 
	three : function(callback){
		setTimeout(function(){
			console.log(200);
			callback(null, 200);
		}, 500);
	}
};
loop.parallel(obj, function(err, results){
	console.log("err : ", err);
	console.log("results : ", JSON.stringify(results));
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case14 End");
*/


console.log("Case15 Start => Array(or Object). Like as 'async.series'. But sub functions run parallel.");
console.log("Start : Now Second : ", new Date().getSeconds());
var obj = [
	[
		function(cb){
			setTimeout(function(){console.log(new Date().getSeconds(), "sub1");
			cb(null, "sub1");}, 1000)
	}, 
		function(cb){
			setTimeout(function(){console.log(new Date().getSeconds(), "sub2");
			cb(null, "sub2");}, 1000)
		}
	],
	function(callback){
		setTimeout(function(){
			console.log(new Date().getSeconds(), 100);
			callback(null, 100);
		}, 1000);
	}, 
	function(callback){
		setTimeout(function(){
			console.log(new Date().getSeconds(), 200);
			callback(null, 200);
		}, 1000);
	}
];
loop.series(obj, function(err, results){
	console.log("err : ", err);
	console.log("results : ", JSON.stringify(results));
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case15 End");

/*
Case15 Start => Array(or Object). Like as 'async.series'. But sub functions run
parallel.
Start : Now Second :  59
Case15 End
0 'sub1'
0 'sub2'
1 100
2 200
err :  undefined
results :  [["sub1","sub2"],100,200]
Result : Now Second :  2
*/