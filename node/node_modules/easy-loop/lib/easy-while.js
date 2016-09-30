function easyWhile(condition, func, last){
	var run = function(){
		if(condition())	func(next);
		else
		{
			if(last) last();
		}
	};
	var next = function(err){
		if(err)
		{
			if(last) last(err);
		}
		else	run();
	};
	run();
}
module.exports = easyWhile;