/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, node: true */
/*global */

(function () {
    "use strict";
    
    var EFTP = require('eftp'),
        safezone = require('domain').create(),
        stackTrace = require('stack-trace'),
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
                            console.log(params.trace);
                            params.info_string = JSON.stringify(params.info) || '';
                            break;
                        }
                    }
                    _domainManager.emitEvent("eqFTP", "event", params);
                },
                getCodeLine: function () {
                    return 1;
                },
                uniq: function () {
                    var n = Date.now(),
                        suf = '';
                    if (!eqftp.variables._uniq) {
                        eqftp.variables._uniq = {
                            n: n,
                            suffix: 0
                        };
                    } else {
                        if (eqftp.variables._uniq.n && eqftp.variables._uniq.n === n) {
                            eqftp.variables._uniq.suffix++;
                            suf = eqftp.variables._uniq.suffix;
                        } else {
                            eqftp.variables._uniq.suffix = 0;
                        }
                    }
                    return n.toString(32) + suf;
                }
            },
            connection: {
                _open: function (params, callback) {
                    try {
                        c[params.connection_hash] = {
                            server: new EFTP()
                        };
                        
                        c[params.connection_hash].server.on('ready', function () {
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
                                trace: {
                                    func: stackTrace.get()[0].getFunctionName(),
                                    filename: stackTrace.get()[0].getFileName(),
                                    line: stackTrace.get()[0].getLineNumber()
                                },
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
                            password: params.password,
                            debugMode: true
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
                            trace: {
                                func: stackTrace.get()[0].getFunctionName(),
                                filename: stackTrace.get()[0].getFileName(),
                                line: stackTrace.get()[0].getLineNumber()
                            },
                            info: err.message || err
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
                        try {
                            eqftp.connection._open(params, function (result) {
                                if (result) {
                                    eqftp.ftp.pwd({
                                        connection: params,
                                        callback: function (result) {
                                            if (result) {
                                                c[params.connection_hash].start_path = result;
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
                        } catch (err) {
                            eqftp.utils.event({
                                action: 'debug',
                                trace: {
                                    func: stackTrace.get()[0].getFunctionName(),
                                    filename: stackTrace.get()[0].getFileName(),
                                    line: stackTrace.get()[0].getLineNumber()
                                },
                                info: err.message || err
                            });
                            if (callback && eqftp.utils.check.isFunction(callback)) {
                                callback(false);
                            }
                        }
                    } else {
                        if (eqftp.utils.check.isFunction(callback)) {
                            callback(true);
                        }
                    }
                }
            },
            ftp: {
                getSymlinkInfo: function (params) {
                    /*
                    connection, path
                    */
                    c[params.connection_hash].server.exist(params.element.full_path, _.once(function (exist) {
                        if (!exist) {
                            if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                params.callback(false);
                            }
                            return false;
                        } else {
                            c[params.connection_hash].server.ls(params.element.full_path, _.once(function (err, contents) {
                                if (err) {
                                    /* ITS A FILE! */
                                    eqftp.utils.event({
                                        action: 'debug',
                                        trace: {
                                            func: stackTrace.get()[0].getFunctionName(),
                                            filename: stackTrace.get()[0].getFileName(),
                                            line: stackTrace.get()[0].getLineNumber()
                                        },
                                        info: err
                                    });
                                    if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                        params.callback('f');
                                    }
                                    return false;
                                } else {
                                    /* ITS A FOLDERINO! */
                                    if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                        params.callback('d');
                                    }
                                }
                            }));
                        }
                    }));
                },
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
                                params.path = eqftp.utils.normalize(c[params.connection.connection_hash].start_path + '/' + params.path);
                            }
                            params.start_path = c[params.connection.connection_hash].start_path;
                            c[params.connection.connection_hash].server.cd(params.path, _.once(function (err) {
                                if (err) {
                                    eqftp.utils.event({
                                        action: 'debug',
                                        trace: {
                                            func: stackTrace.get()[0].getFunctionName(),
                                            filename: stackTrace.get()[0].getFileName(),
                                            line: stackTrace.get()[0].getLineNumber()
                                        },
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
                                trace: {
                                    func: stackTrace.get()[0].getFunctionName(),
                                    filename: stackTrace.get()[0].getFileName(),
                                    line: stackTrace.get()[0].getLineNumber()
                                },
                                info: err.message || err
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
                                params.path = eqftp.utils.normalize(c[params.connection.connection_hash].start_path + '/' + params.path);
                            } else if (!eqftp.utils.check.isString(params.path)) {
                                params.path = eqftp.utils.normalize(c[params.connection.connection_hash].start_path + '/');
                            }
                            params.start_path = c[params.connection.connection_hash].start_path;
                            c[params.connection.connection_hash].server.ls(params.path, _.once(function (err, contents) {
                                if (err) {
                                    eqftp.utils.event({
                                        action: 'debug',
                                        trace: {
                                            func: stackTrace.get()[0].getFunctionName(),
                                            filename: stackTrace.get()[0].getFileName(),
                                            line: stackTrace.get()[0].getLineNumber()
                                        },
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
                                contents.forEach(function (v, i) {
                                    if (!v.filename) {
                                        contents[i].filename = v.name;
                                    }
                                    contents[i].full_path = eqftp.utils.normalize(params.path + '/' + v.filename);
                                    if (v.longname && v.longname.indexOf('l') === 0) {
                                        contents[i].type = 'l';
                                    }
                                });
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
                                trace: {
                                    func: stackTrace.get()[0].getFunctionName(),
                                    filename: stackTrace.get()[0].getFileName(),
                                    line: stackTrace.get()[0].getLineNumber()
                                },
                                info: err.message || err
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
                                        trace: {
                                            func: stackTrace.get()[0].getFunctionName(),
                                            filename: stackTrace.get()[0].getFileName(),
                                            line: stackTrace.get()[0].getLineNumber()
                                        },
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
                                trace: {
                                    func: stackTrace.get()[0].getFunctionName(),
                                    filename: stackTrace.get()[0].getFileName(),
                                    line: stackTrace.get()[0].getLineNumber()
                                },
                                info: err.message || err
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
                exist: function (params) {
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
                            c[params.connection.connection_hash].server.exist(params.path, _.once(function (exist) {
                                if (params._id) {
                                    eqftp.utils.event({
                                        action: 'callback',
                                        _id: params._id,
                                        callback: exist
                                    });
                                } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                    params.callback(exist);
                                }
                            }));
                        } catch (err) {
                            eqftp.utils.event({
                                action: 'debug',
                                trace: {
                                    func: stackTrace.get()[0].getFunctionName(),
                                    filename: stackTrace.get()[0].getFileName(),
                                    line: stackTrace.get()[0].getLineNumber()
                                },
                                info: err.message || err
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
                raw: function (params) {
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
                            c[params.connection.connection_hash].server.e_raw(params.params, _.once(function (err, data) {
                                if (err) {
                                    eqftp.utils.event({
                                        action: 'debug',
                                        trace: {
                                            func: stackTrace.get()[0].getFunctionName(),
                                            filename: stackTrace.get()[0].getFileName(),
                                            line: stackTrace.get()[0].getLineNumber()
                                        },
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
                                        callback: data
                                    });
                                } else if (params.callback && eqftp.utils.check.isFunction(params.callback)) {
                                    params.callback(data);
                                }
                            }));
                        } catch (err) {
                            eqftp.utils.event({
                                action: 'debug',
                                trace: {
                                    func: stackTrace.get()[0].getFunctionName(),
                                    filename: stackTrace.get()[0].getFileName(),
                                    line: stackTrace.get()[0].getLineNumber()
                                },
                                info: err.message || err
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
                download: function (params) {
                    /*
                    connection, localpath, remotepath
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
                            c[params.connection.connection_hash].server.download(params.remotepath, params.localpath, function (err, data) {
                                console.log(err, data);
                                if (err) {
                                    eqftp.utils.event({
                                        action: 'debug',
                                        trace: {
                                            func: stackTrace.get()[0].getFunctionName(),
                                            filename: stackTrace.get()[0].getFileName(),
                                            line: stackTrace.get()[0].getLineNumber()
                                        },
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
                            });
                        } catch (err) {
                            eqftp.utils.event({
                                action: 'debug',
                                trace: {
                                    func: stackTrace.get()[0].getFunctionName(),
                                    filename: stackTrace.get()[0].getFileName(),
                                    line: stackTrace.get()[0].getLineNumber()
                                },
                                info: err.message || err
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
    
    safezone.on('error', function (err) {
        eqftp.utils.event({
            action: 'error',
            text: 'Some error happened',
            errType: 'connections',
            error: err
        });
        eqftp.utils.event({
            action: 'debug',
            trace: {
                func: stackTrace.get()[0].getFunctionName(),
                filename: stackTrace.get()[0].getFileName(),
                line: stackTrace.get()[0].getLineNumber()
            },
            info: err
        });
    });
    
    console.log('Version: ' + process.version);
    
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
                        safezone.run(function () {
                            /* LOL WHAT COULD HAPPEN LOL ITS DOMAINS FUCK WARNINGS */
                            try {
                                tmp[o](params);
                            } catch (err) {
                                eqftp.utils.event({
                                    action: 'debug',
                                    trace: {
                                        func: stackTrace.get()[0].getFunctionName(),
                                        filename: stackTrace.get()[0].getFileName(),
                                        line: stackTrace.get()[0].getLineNumber()
                                    },
                                    info: err.message || err
                                });
                            }
                        });
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