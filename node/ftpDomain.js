/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, node: true */
/*global */

(function () {
    "use strict";
    
    var EasyFTP = require('easy-ftp');
    var ftp = new EasyFTP(),
        
        _ = require("lodash"),
        
        _domainManager,
        
        eqftp = {
            utils: {
                check: {
                    isFunction: function (input) {
                        var getType = {};
                        return input && getType.toString.call(input) === '[object Function]';
                    },
                    isJSON: function (input) {
                        try { JSON.parse(input); } catch (e) { return false; }
                        return true;
                    },
                    isObject: function (input) {
                        if (input !== null && typeof input === 'object') { return true; }
                        return false;
                    },
                    isString: function (input) {
                        var getType = {};
                        return input && getType.toString.call(input) === '[object String]';
                    },
                    isArray: function (input) {
                        return _.isArray(input);
                    }
                },
                event: function (params) {
                    _domainManager.emitEvent("eqFTP", "event", params);
                }
            }
        };
    
    function init(DomainManager) {
        if (!DomainManager.hasDomain("eqFTP")) {
            DomainManager.registerDomain("eqFTP", {major: 1, minor: 0});
        }
        _domainManager = DomainManager;

        DomainManager.registerCommand(
            "eqFTP",
            "do",
            function (command, params) {
                var tmp = eqftp,
                    args = {};
                if (!eqftp.utils.check.isArray(command)) {
                    command = command.split('__');
                }
                command.some(function (o, n) {
                    if (eqftp.utils.check.isObject(tmp[o])) {
                        tmp = tmp[o];
                    } else if (eqftp.utils.check.isFunction(tmp[o])) {
                        tmp[o](params);
                        return true;
                    } else {
                        return true;
                    }
                });
            },
            false
        );
    }
    exports.init = init;
}());