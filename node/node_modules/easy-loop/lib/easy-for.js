function easyFor(obj, func, concurrency, last){
	var max = 0;
	var isArr = obj instanceof Array;
	var isNum = false;
	var keys = null;
	
	if(obj instanceof Array)	max = obj.length;
	else if(obj instanceof Object)
	{
		keys = Object.keys(obj);
		max = keys.length;
	}
	else if(typeof obj === 'number' && obj >= 0)
	{
		isNum = true;
		max = obj;
	}
	else	throw "first argument is not Array or Object or number of iterations  => " + obj;
	
	if((arguments.length === 3 || arguments.length === 4) && typeof func === 'number' && typeof concurrency === 'function')
	{
		var temp = func;
		func = concurrency;
		concurrency = temp;
	}
	if(typeof concurrency === 'function')
	{
		last = concurrency;
		concurrency = 1;
	}
	else
	{
		if(!concurrency || isNaN(concurrency))	concurrency = 1;	
		else	concurrency = parseInt(concurrency);
	}	
	var count = {start:0, end:0, processing:0};	
	var next = function(err){
		count.processing--;
		count.end++;
		if(count.end >= max || err)
		{
			if(last)
			{				
				if(err) last(err);
				else	last();
			}
		}
		else	run();
	};
	var run = function(){
		if(max > count.start)
		{
			count.processing++;
			if(isArr)	func(count.start, obj[count.start++], next);
			else if(isNum) func(count.start++, next);
			else		func(keys[count.start], obj[keys[count.start++]], next);
			if(max > count.start && count.processing < concurrency)	run();
		}
	};	
	max == 0 ? next() : run();
}
module.exports = easyFor;