/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, node: true */
/*global */

(function () {
    "use strict";
    
    var EasyFTP = require('easy-ftp'),
        _ = require("lodash");
        
    var _domainManager,
        c = {},
        
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
                        return getType.toString.call(input) === '[object String]';
                    },
                    isArray: function (input) {
                        return _.isArray(input);
                    }
                },
                normalize: function (path) {
                    if (eqftp.utils.check.isString(path)) {
                        return path.replace(/\\+/g, '/').replace(/\/\/+/g, '/');
                    }
                    return path;
                },
                event: function (params) {
                    if (params.action) {
                        switch (params.action) {
                        case 'debug':
                            params.info_string = JSON.stringify(params.info);
                            break;
                        }
                    }
                    _domainManager.emitEvent("eqFTP", "event", params);
                }
            },
            connection: {
                _open: function (params, callback) {
                    try {
                        c[params.connection_hash] = {
                            server: new EasyFTP()
                        };
                        
                        c[params.connection_hash].server.on('open', function () {
                            eqftp.utils.event({
                                action: 'connection',
                                id: params.id,
                                status: 'open'
                            });
                            if (eqftp.utils.check.isFunction(callback)) {
                                callback(true);
                            }
                        });
                        c[params.connection_hash].server.on('close', function () {
                            eqftp.utils.event({
                                action: 'connection',
                                id: params.id,
                                status: 'close'
                            });
                            if (eqftp.utils.check.isFunction(callback)) {
                                callback(false);
                            }
                            eqftp.connection._destroy(params.connection_hash);
                        });
                        c[params.connection_hash].server.on('error', function (err) {
                            eqftp.utils.event({
                                action: 'connection',
                                id: params.id,
                                status: 'error',
                                errType: 'connections',
                                error: err
                            });
                            eqftp.utils.event({
                                action: 'debug',
                                info: err
                            });
                            if (eqftp.utils.check.isFunction(callback)) {
                                callback(false);
                            }
                            eqftp.connection._destroy(params.connection_hash);
                        });
                        
                        var settings = {
                            host: params.server,
                            type: params.protocol,
                            port: params.port || 21,
                            username: params.login,
                            password: params.password
                        };
                        if (params.rsa) {
                            settings.privateKey = params.rsa;
                        }
                        c[params.connection_hash].server.connect(settings);
                    } catch (err) {
                        eqftp.utils.event({
                            action: 'connection',
                            id: params.id,
                            status: 'error'
                        });
                        eqftp.utils.event({
                            action: 'debug',
                            info: err.message
                        });
                        eqftp.connection._destroy(params.connection_hash);
                    }
                },
                _destroy: function (hash) {
                    if (c.interval) {
                        clearInterval(c.interval);
                    }
                    _.unset(c, hash);
                },
                create: function (params, callback) {
                    if (!params.connection_hash) {
                        eqftp.utils.event({
                            action: 'error',
                            text: '$eqftp__domain__connection__create__error'
                        });
                    }
                    
                    if (!c[params.connection_hash]) {
                        eqftp.connection._open(params, function(result) {
                            if (result) {
                                eqftp.ftp.pwd({
                                    connection: params,
                                    callback: function (result) {
                                        if (result) {
                                            c[params.connection_hash].start_dir = result;
                                        }
                                        if (eqftp.utils.check.isFunction(callback)) {
                                            callback(result);
                                        }
                                    }
                                });
                            } else if (eqftp.utils.check.isFunction(callback)) {
                                callback(result);
                            }
                        });
                    } else {
                        if (eqftp.utils.check.isFunction(callback)) {
                            callback(true);
                        }
                    }
                }
            },
            ftp: {
                cd: function (params) {
                    /*
                    connection, path
                    */
                    eqftp.connection.create(params.connection, _.once(function (result) {
                        if (!result) {
                            if (params._id) {
                                eqftp.utils.event({
                                    action: 'callback',
                                    _id: params._id,
                                    callback: false
                                });
                            } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                params.callback(false);
                            }
                            return false;
                        }
                        try {
                            if (eqftp.utils.check.isString(params.path) && !params.path.match(/^\//)) {
                                params.path = eqftp.utils.normalize(c[params.connection.connection_hash].start_dir + '/' + params.path);
                            }
                            c[params.connection.connection_hash].server.cd(params.path, _.once(function (err) {
                                if (err) {
                                    eqftp.utils.event({
                                        action: 'debug',
                                        info: err
                                    });
                                    if (params._id) {
                                        eqftp.utils.event({
                                            action: 'callback',
                                            _id: params._id,
                                            callback: false
                                        });
                                    } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                        params.callback(false);
                                    }
                                    return false;
                                }
                                if (params._id) {
                                    eqftp.utils.event({
                                        action: 'callback',
                                        _id: params._id,
                                        callback: true
                                    });
                                } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                    params.callback(true);
                                }
                            }));
                        } catch (err) {
                            eqftp.utils.event({
                                action: 'debug',
                                info: err.message
                            });
                            if (params._id) {
                                eqftp.utils.event({
                                    action: 'callback',
                                    _id: params._id,
                                    callback: false
                                });
                            } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                params.callback(false);
                            }
                        }
                    }));
                },
                ls: function (params) {
                    /*
                    connection, path
                    */
                    eqftp.connection.create(params.connection, _.once(function (result) {
                        if (!result) {
                            if (params._id) {
                                eqftp.utils.event({
                                    action: 'callback',
                                    _id: params._id,
                                    callback: false
                                });
                            } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                params.callback(false);
                            }
                            return false;
                        }
                        try {
                            if (eqftp.utils.check.isString(params.path) && !params.path.match(/^\//)) {
                                params.path = eqftp.utils.normalize(c[params.connection.connection_hash].start_dir + '/' + params.path);
                            }
                            eqftp.utils.event({
                                action: 'debug',
                                info: [params.path]
                            });
                            c[params.connection.connection_hash].server.ls(params.path, _.once(function (err, contents) {
                                if (err) {
                                    eqftp.utils.event({
                                        action: 'debug',
                                        info: err
                                    });
                                    if (params._id) {
                                        eqftp.utils.event({
                                            action: 'callback',
                                            _id: params._id,
                                            callback: false
                                        });
                                    } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                        params.callback(false);
                                    }
                                    return false;
                                }
                                if (params._id) {
                                    eqftp.utils.event({
                                        action: 'callback',
                                        _id: params._id,
                                        callback: {
                                            contents: contents,
                                            params: params
                                        }
                                    });
                                } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                    params.callback({
                                        contents: contents,
                                        params: params
                                    });
                                }
                            }));
                        } catch (err) {
                            eqftp.utils.event({
                                action: 'debug',
                                info: err.message
                            });
                            if (params._id) {
                                eqftp.utils.event({
                                    action: 'callback',
                                    _id: params._id,
                                    callback: false
                                });
                            } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                params.callback(false);
                            }
                        }
                    }));
                },
                pwd: function (params) {
                    /*
                    connection, path
                    */
                    eqftp.connection.create(params.connection, _.once(function (result) {
                        if (!result) {
                            if (params._id) {
                                eqftp.utils.event({
                                    action: 'callback',
                                    _id: params._id,
                                    callback: false
                                });
                            } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                params.callback(false);
                            }
                            return false;
                        }
                        try {
                            c[params.connection.connection_hash].server.pwd(_.once(function (err, contents) {
                                if (err) {
                                    eqftp.utils.event({
                                        action: 'debug',
                                        info: err
                                    });
                                    if (params._id) {
                                        eqftp.utils.event({
                                            action: 'callback',
                                            _id: params._id,
                                            callback: false
                                        });
                                    } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                        params.callback(false);
                                    }
                                    return false;
                                }
                                if (params._id) {
                                    eqftp.utils.event({
                                        action: 'callback',
                                        _id: params._id,
                                        callback: contents
                                    });
                                } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                    params.callback(contents);
                                }
                            }));
                        } catch (err) {
                            eqftp.utils.event({
                                action: 'debug',
                                info: err.message
                            });
                            if (params._id) {
                                eqftp.utils.event({
                                    action: 'callback',
                                    _id: params._id,
                                    callback: false
                                });
                            } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                params.callback(false);
                            }
                        }
                    }));
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
            "_do",
            function (command, params) {
                if (!eqftp.utils.check.isArray(command)) {
                    command = command.split('__');
                }
                var tmp = eqftp;
                command.some(function (o, n) {
                    if (eqftp.utils.check.isObject(tmp[o])) {
                        tmp = tmp[o];
                    } else if (eqftp.utils.check.isFunction(tmp[o])) {
                        try {
                            tmp[o](params);
                        } catch (err) {
                            eqftp.utils.event({
                                action: 'debug',
                                info: err.message
                            });
                        }
                        return true;
                    } else {
                        return true;
                    }
                });
            },
            false
        );
        DomainManager.registerEvent(
            "eqFTP",
            "event"
        );
    }
    exports.init = init;
}());