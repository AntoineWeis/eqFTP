/**
 * sync easy loop
 */
var easyWhile = require('./easy-while');
var easyFor = require('./easy-for');
var easyManual = require('./easy-manual');
var easyAsync = require('./easy-async');

function loop(obj, func, concurrency, last){
	if(typeof obj === 'function')
	{
		if(typeof concurrency === 'function') last = concurrency;
		easyWhile(obj, func, last);
	}
	else
	{
		easyFor(obj, func, concurrency, last);
	}
}
loop["for"] = loop["while"] = loop["loop"] = loop["forEach"] = loop;
loop["create"] = easyManual;
loop["series"] = easyAsync.series;
loop["parallel"] = easyAsync.parallel;

module.exports = loop;