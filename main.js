/*
 * Copyright (c) 2015 Equals182.
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50  */
/*global define, brackets, Mustache, $, Promise*/

define(function (require, exports, module) {
    "use strict";
    
    var AppInit = brackets.getModule("utils/AppInit"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        FileSystem = brackets.getModule("filesystem/FileSystem"),
        FileUtils = brackets.getModule("file/FileUtils"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        
        strings = require("strings"),
        CryptoJS = require("crypto-js/crypto-js"),
        dateFormat = require("date-format/date_format"),
        
        _ = require("lodash"),
        
        tpl__toolbar = Mustache.render(require("text!htmlContent/toolbar.html"), strings),
        tpl__panel = Mustache.render(require("text!htmlContent/panel.html"), strings),
        tpl__panel__searchDropdown__outer = Mustache.render(require("text!htmlContent/panel__searchDropdown--outer.html"), strings),
        tpl__panel__searchDropdown__row = Mustache.render(require("text!htmlContent/panel__searchDropdown--row.html"), strings),
        
        _defaultEqFTPFolder = brackets.app.getUserDocumentsDirectory(),
        _homeFolder = _defaultEqFTPFolder,
        _eqFTPSettings = {},
        _eqFTPPassword = false,
        
        _version = "0.8.0",
        eqftp = {
            ui: {
                toolbar: {
                    toggle: function () {
                        eqftp.variables.ui.eqftp_panel = $(".eqftp-panel");
                        if (eqftp.variables.ui.eqftp_panel.length !== 1) {
                            eqftp.variables.ui.content.after(tpl__panel);
                            eqftp.variables.ui.eqftp_panel = $(".eqftp-panel");
                            
                            if (eqftp.variables.eqFTP.misc.first_start) {
                                var tpl__welcome_screen = Mustache.render(require("text!htmlContent/welcome_screen.html"), strings);
                                eqftp.variables.ui.eqftp_panel = $(".eqftp-panel");
                                eqftp.variables.ui.eqftp_panel.prepend(tpl__welcome_screen);
                                eqftp.variables.eqFTP.misc.first_start = false;
                                eqftp._preferences.set();
                            }
                        }
                        if (eqftp.variables.ui.eqftp_panel.is(":visible")) {
                            eqftp.variables.ui.eqftp_panel.hide();
                            eqftp.variables.ui.content.css("right", eqftp.variables.defaults.main_view__content__right);
                        } else {
                            var panel__right_offset = $(window).innerWidth() - (eqftp.variables.ui.content.offset().left + eqftp.variables.ui.content.width());
                            eqftp.variables.ui.eqftp_panel.css("right", panel__right_offset);
                            eqftp.variables.ui.content.css("right", (eqftp.variables.defaults.panel__width + panel__right_offset));
                            eqftp.variables.ui.eqftp_panel.width(eqftp.variables.defaults.panel__width).show();
                        }
                        eqftp.ui.scrollbar.render_all();
                    }
                },
                panel: {
                    toolbar: {
                        search: {
                            dropdown: {
                                render: function (rerender) {
                                    if ($(eqftp.variables.ui.eqftp_panel__server_list).length === 0 || (rerender && rerender === 'rerender')) {
                                        var out = "";
                                        out += eqftp.utils.render(tpl__panel__searchDropdown__row, {title: 'T', host: 'H', user: 'U'});
                                        out += eqftp.utils.render(tpl__panel__searchDropdown__row, {title: 'T2', host: 'H2', user: 'U2'});
                                        out = eqftp.utils.render(tpl__panel__searchDropdown__outer, {content: out});
                                        if ($(eqftp.variables.ui.eqftp_panel__server_list).length === 1) {
                                            $(eqftp.variables.ui.eqftp_panel__server_list).remove();
                                        }
                                        $('.eqftp-panel__header__inputHolder').append(out);
                                    }
                                },
                                toggle: function () {
                                    eqftp.ui.panel.toolbar.search.dropdown.render();
                                    if (!$(eqftp.variables.ui.eqftp_panel__server_list).is(":visible")) {
                                        $('.eqftp-panel__header__input').focus();
                                    }
                                    $(eqftp.variables.ui.eqftp_panel__server_list).slideToggle(80);
                                },
                                show: function () {
                                    eqftp.ui.panel.toolbar.search.dropdown.render();
                                    $(eqftp.variables.ui.eqftp_panel__server_list).slideDown(80);
                                }
                            },
                            mode: {
                                filter: function () {
                                    var v = $('.eqftp-panel__header__input').val();
                                    if (v) {
                                        var r = new RegExp('.*?' + v + '.*?', 'i');
                                        $.each($('.eqftp-panel__server_dropdown_item'), function () {
                                            var fi = $(this).attr('data-fullinfo');
                                            if (!r.test(fi)) {
                                                $(this).hide();
                                            } else {
                                                $(this).show();
                                            }
                                        });
                                        $('.eqftp-panel__header__inputHolder__iconClear').fadeIn(200);
                                        $('.eqftp-panel__header__inputHolder__iconDropdown').fadeOut(200);
                                    } else {
                                        $('.eqftp-panel__server_dropdown_item').show();
                                        $('.eqftp-panel__header__inputHolder__iconClear').fadeOut(200);
                                        $('.eqftp-panel__header__inputHolder__iconDropdown').fadeIn(200);
                                    }
                                }
                            }
                        },
                        infofooter: {
                            toggle: function (params, e) {
                                if ($(e.target).closest('.eqftp-infofooter--msgholder').length > 0) {
                                    $('.eqftp-panel__infofooter').toggleClass('fullsized');
                                    eqftp.ui.scrollbar.render($('.eqftp-panel__infofooter > .eqftp-scrollbar'));
                                }
                            }
                        }
                    },
                    settings_window: {
                        toggle: function (params, e) {
                            if ($(e.target).closest('.eqftp-hamburger').length > 0) {
                                $(e.target).closest('.eqftp-hamburger').toggleClass('active');
                            }
                            $('.eqftp-panel__header__inputHolder').toggleClass('eqftp-invisible');
                            $('.eqftp-panel__header__settingsHeader').toggleClass('eqftp-invisible');
                            $('.eqftp-panel__settings_window').toggleClass('active');
                        },
                        utils: {
                            settings_path_ofd: function (params, e) {
                                if (!params.title) {
                                    params.title = strings.eqftp__file_opening_dialog_title;
                                }
                                if (!params.start_path) {
                                    params.start_path = _homeFolder;
                                }
                                if (params.callback) {
                                    if (eqftp.utils.check.isString(params.callback)) {
                                        params.callback = eqftp.variables.functions[params.callback];
                                    }
                                }
                                eqftp.utils.open_file_dialog(params);
                            },
                            settings_create_file_callback: function (error, result) {
                                if (error) {
                                    // Error / Cancel
                                } else {
                                    // Okay
                                    eqftp._settings.create(result);
                                }
                            },
                            settings_create_file: function (params, e) {
                                if (!params.title) {
                                    params.title = strings.eqftp__settings_file_create_dialog_title;
                                }
                                if (!params.callback) {
                                    params.callback = eqftp.ui.panel.settings_window.utils.settings_create_file_callback;
                                }
                                if (!params.start_path) {
                                    params.start_path = _homeFolder;
                                }
                                eqftp.utils.save_file_dialog(params);
                            },
                            save: function () {
                                $('[name^="eqftpSettings"]').each(function () {
                                    var matches = $(this).attr('name').match(/([^\[\]]+)/gm),
                                        value = $(this).val();
                                    if ($(this).attr('type') === 'checkbox') {
                                        value = false;
                                        if ($(this).is(':checked')) {
                                            value = true;
                                        }
                                    }
                                    _eqFTPSettings = eqftp.utils.addToObject(matches, value, _eqFTPSettings);
                                });
                                eqftp._settings.save();
                            },
                            _setValue: function (path, donor) {
                                if (!donor) {
                                    donor = _eqFTPSettings;
                                }
                                if (!eqftp.utils.check.isArray(path) || !eqftp.utils.check.isObject(donor)) {
                                    return false;
                                }
                                var tmp = donor,
                                    tmpstr = '';
                                path.forEach(function (v, i) {
                                    if (tmp[v] !== undefined) {
                                        tmpstr += '[' + v + ']';
                                        tmp = tmp[v];
                                    }
                                });
                                var selector = $('[name="eqftpSettings' + tmpstr + '"]');
                                if (selector.length) {
                                    var type = selector.attr('type');
                                    switch (type) {
                                    case 'checkbox':
                                        selector.prop('checked', !!tmp);
                                        break;
                                    case 'text':
                                        selector.val(tmp);
                                        break;
                                    default:
                                        if (selector.is('select')) {
                                            selector.find('option[value="' + tmp + '"]').prop('selected', true);
                                        }
                                        break;
                                    }
                                }
                            },
                            write_connections_name: function (params, e) {
                                var group = $(e.target).closest('.eqftp-accordion-group'),
                                    input = group.find('#eqftp-connection__name'),
                                    header = group.find('.eqftp-accordion-heading .eqftp-connection-name'),
                                    val = input.val()?input.val():strings.eqftp__connection__name_placeholder;
                                header.text(val);
                                var lp = group.find('#eqftp-connection__localpath');
                                if (lp.attr('data-changed') == 'false') {
                                    lp.val(eqftp.utils.normalize(_eqFTPSettings.main.projects_folder + '/' + val));
                                }
                            }
                        },
                        render: function () {
                            this.utils._setValue(['misc', 'encrypted']);
                            this.utils._setValue(['main', 'projects_folder']);
                            this.utils._setValue(['main', 'date_format']);
                        }
                    }
                },
                tab: {
                    toggle: function (params, e) {
                        if ($(params.target).hasClass('active')) {
                            $(params.target).slideUp(200).removeClass('active');
                            $(e.target).closest('.eqftp__tab_controller').removeClass('active');
                        } else {
                            $(params.target)
                                .closest('.eqftp__tabs_holder')
                                .find('.eqftp__tab.active')
                                .slideUp(200)
                                .removeClass('active');
                            $(params.target)
                                .closest('.eqftp__tabs_holder')
                                .find('.eqftp__tab_controller.active')
                                .removeClass('active');
                            $(params.target).slideDown(200).addClass('active');
                            $(e.target).closest('.eqftp__tab_controller').addClass('active');
                        }
                    }
                },
                scrollbar: {
                    render: function (action, event) {
                        var i = setInterval(_.throttle(function () {
                            var e;
                            if (action instanceof $ && $(action).length > 0) {
                                e = $(action);
                            } else if (action.target && $(action.target).length > 0) {
                                e = $(action.target);
                            } else if ($(event.target).closest('.eqftp-scrollbar').length > 0) {
                                e = $(event.target).closest('.eqftp-scrollbar');
                            } else {
                                return false;
                            }
                            if ($(e).length > 0) {
                                var container = $(e).parent().height(),
                                    content = $(e).next().height(),
                                    handle = $(e).children('div'),
                                    bar = $(e).height(),
                                    h = (bar * (container / content)),
                                    hp = (100 * (container / content));
                                if (h < 10) {
                                    h = 10;
                                    handle.height(h);
                                } else {
                                    handle.height(hp + "%");
                                }
                            }
                            clearInterval(i);
                        }, 300), 300);
                    },
                    render_all: function () {
                        $('.eqftp-scrollbar').each(function () {
                            eqftp.ui.scrollbar.render($(this));
                        });
                    }
                },
                accordion: function (params, e) {
                    var t = e.target,
                        group = $(t).closest('.eqftp-accordion-group'),
                        supergroup = group.closest('.eqftp-accordion'),
                        others = supergroup.find('.eqftp-accordion-group').not(group);
                    others.removeClass('eqftp-active');
                    group.toggleClass('eqftp-active');
                },
                clone: function (params, e) {
                    var clone = $(params.from).clone();
                    $(params.to).prepend(clone);
                    if (eqftp.utils.check.isFunction(params.callback)) {
                        params.callback(clone);
                    } else if (eqftp.utils.check.isString(params.callback)) {
                        var f = eqftp.variables.functions[params.callback];
                        if (eqftp.utils.check.isFunction(f)) {
                            f(clone);
                        }
                    }
                }
            },
            utils: {
                // accepts string `path__to__method--parameter=value;second=foobar` excluding eqftp in start
                action: function (action, event, returnit) {
                    var actions = action.split('--'),
                        methods = actions[0].split('__'),
                        tmp = eqftp,
                        args = {};
                    if (!!actions[1]) {
                        var arguments_pairs = actions[1].split(';');
                        arguments_pairs.forEach(function (pair, n) {
                            pair = pair.split('=');
                            args[pair[0]] = pair[1];
                        });
                    }
                    methods.some(function (o, n) {
                        if (eqftp.utils.check.isObject(tmp[o])) {
                            tmp = tmp[o];
                        } else if (eqftp.utils.check.isFunction(tmp[o])) {
                            if (returnit) {
                                return tmp[o];
                            }
                            tmp[o](args, event);
                            return true;
                        } else {
                            if (returnit) {
                                return function () {};
                            }
                            return true;
                        }
                    });
                },
                // all sorts of checks
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
                resize: {
                    srv: {
                        theobject: null,
                        thedependent: null,
                        direction: function (el) {
                            var xPos, yPos, offset, dir;
                            if (undefined !== (dir = $(el).attr('eqftp-resize'))) {
                                return dir;
                            }
                            dir = "";

                            xPos = window.event.offsetX;
                            yPos = window.event.offsetY;

                            offset = 8; //The distance from the edge in pixels

                            if (yPos < offset) {
                                dir += "n";
                            } else if (yPos > el.offsetHeight - offset) {
                                dir += "s";
                            }
                            if (xPos < offset) {
                                dir += "w";
                            } else if (xPos > el.offsetWidth - offset) {
                                dir += "e";
                            }

                            return dir;
                        },
                        down: function (el, sticker) {
                            var dir = eqftp.utils.resize.srv.direction(el);
                            if (dir === "") {
                                return;
                            }

                            eqftp.utils.resize.srv.theobject = {
                                el: null,
                                dir: "",
                                grabx: null,
                                graby: null,
                                width: null,
                                height: null,
                                left: null,
                                top: null
                            };

                            var theobject = eqftp.utils.resize.srv.theobject;
                            theobject.el = el;
                            theobject.dir = dir;

                            theobject.grabx = window.event.clientX;
                            theobject.graby = window.event.clientY;
                            theobject.width = el.offsetWidth;
                            theobject.height = el.offsetHeight;
                            theobject.left = el.offsetLeft;
                            theobject.top = el.offsetTop;

                            window.event.returnValue = false;
                            window.event.cancelBubble = true;
                        },
                        up: function () {
                            if (eqftp.utils.resize.srv.theobject) {
                                eqftp.utils.resize.srv.theobject.el.style.cursor = "default";
                            }
                            eqftp.utils.resize.srv.theobject = null;
                        },
                        move: function () {
                            var el, xPos, yPos, str, xMin, yMin,
                                theobject = eqftp.utils.resize.srv.theobject;
                            xMin = 8; //The smallest width possible
                            yMin = 8; //             height

                            //Dragging starts here
                            if (theobject !== null) {
                                var dir = theobject.dir;
                                el = theobject.el;
                                str = eqftp.utils.resize.srv.direction(el);
                                if (str === "") {
                                    str = "default";
                                } else {
                                    str += "-resize";
                                }
                                el.style.cursor = str;
                                
                                if (dir.indexOf("e") !== -1) { theobject.el.style.width = Math.max(xMin, theobject.width + window.event.clientX - theobject.grabx) + "px"; }
                                if (dir.indexOf("s") !== -1) { theobject.el.style.height = Math.max(yMin, theobject.height + window.event.clientY - theobject.graby) + "px"; }
                                if (dir.indexOf("w") !== -1) {
                                    //theobject.el.style.left = Math.min(theobject.left + window.event.clientX - theobject.grabx, theobject.left + theobject.width - xMin) + "px";
                                    theobject.el.style.width = Math.max(xMin, theobject.width - window.event.clientX + theobject.grabx) + "px";
                                }
                                if (dir.indexOf("n") !== -1) {
                                    //theobject.el.style.top = Math.min(theobject.top + window.event.clientY - theobject.graby, theobject.top + theobject.height - yMin) + "px";
                                    theobject.el.style.height = Math.max(yMin, theobject.height - window.event.clientY + theobject.graby) + "px";
                                }

                                eqftp.variables.defaults.panel__width = $(theobject.el).outerWidth();
                                window.event.returnValue = false;
                                window.event.cancelBubble = true;
                            }
                        }
                    }
                },
                // replaces placeholders with given paremeters
                render: function (tpl, params, prefix) {
                    if (eqftp.utils.check.isString(tpl) && eqftp.utils.check.isObject(params)) {
                        var key;
                        if (!prefix) {
                            prefix = '';
                        }
                        for (key in params) {
                            if (params.hasOwnProperty(key)) {
                                var o = params[key];
                                if (eqftp.utils.check.isObject(o)) {
                                    tpl = eqftp.utils.render(tpl, o, prefix + key + '.');
                                } else if (eqftp.utils.check.isString(o)) {
                                    var str = eqftp.utils.escape('[[' + prefix + key + ']]'),
                                        r = new RegExp(str, 'g');
                                    tpl = tpl.replace(r, o);
                                } else {
                                    return tpl;
                                }
                            }
                        }
                    }
                    return tpl;
                },
                escape: function (str) {
                    return str.replace(/[\-\/\\\^\$\*\+\?\.\(\)|\[\]{}]/g, '\\$&');
                },
                normalize: function (path) {
                    if (eqftp.utils.check.isString(path)) {
                        return path.replace(/\\+/g, '/').replace(/\/\/+/g, '/');
                    }
                    return path;
                },
                open_file_dialog: function (params, e) {
                    if (!params.start_path || !eqftp.utils.check.isString(params.start_path)) {
                        if (e && e.target && $(e.target).is('input')) {
                            params.start_path = $(e.target).val();
                        } else {
                            params.start_path = false;
                        }
                    }
                    if (!params.title || !eqftp.utils.check.isString(params.title)) {
                        params.title = strings.eqftp__file_opening_dialog_title;
                    }
                    if (params.callback && eqftp.utils.check.isString(params.callback)) {
                        var f = eqftp.variables.functions[params.callback];
                        if (eqftp.utils.check.isFunction(f)) {
                            params.callback = f;
                        } else {
                            params.callback = eqftp.utils.action(params.callback, false, true);
                        }
                    } else if (!params.callback || !eqftp.utils.check.isFunction(params.callback)) {
                        params.callback = function () {};
                    }
                    params.directory = params.directory ? true : false;
                    FileSystem.showOpenDialog(false, params.directory, params.title, params.start_path, null, function (error, result) {
                        if (error) {
                            // Error / Cancel
                            if (eqftp.utils.check.isFunction(params.callback)) {
                                params.callback(false, params, e);
                            }
                        } else {
                            // Okay
                            if (eqftp.utils.check.isArray(result)) {
                                result = result[0];
                            }
                            if (eqftp.utils.check.isFunction(params.callback)) {
                                params.callback(result, params, e);
                            }
                        }
                    });
                },
                save_file_dialog: function (params) {
                    if (!params.start_path || !eqftp.utils.check.isString(params.start_path)) {
                        params.start_path = false;
                    }
                    if (!params.title || !eqftp.utils.check.isString(params.title)) {
                        params.title = strings.eqftp__file_saving_dialog_title;
                    }
                    if (params.callback && eqftp.utils.check.isString(params.callback)) {
                        params.callback = eqftp.utils.action(params.callback, false, true);
                    } else if (!params.callback || !eqftp.utils.check.isFunction(params.callback)) {
                        params.callback = function () {};
                    }
                    FileSystem.showSaveDialog(params.title, params.start_path, 'settings.eqftp', params.callback);
                },
                addToObject: function (path, val, obj) {
                    if (path === undefined || val === undefined || !obj) {
                        return obj;
                    }
                    var tmp = obj;
                    path.forEach(function (v, i) {
                        if (v !== 'eqftpSettings') {
                            if (i + 1 === path.length) {
                                tmp[v] = val;
                            } else if (tmp[v] === undefined) {
                                tmp[v] = {};
                            }
                            tmp = tmp[v];
                        }
                    });
                    return obj;
                },
                log: function (text, type) {
                    if (!text) {
                        return false;
                    }
                    if (!type) {
                        type = "info";
                    }
                    var time = dateFormat('hh:mm', new Date());
                    $(".eqftp-infofooter--msgholder").append('<div class="eqftp-infofooter--msg eqftp-infofooter--' + type + '"><span class="eqftp-infofooter--time">' + time + '</span><span>' + text + '</span></div>');
                }
            },
            _password: {
                get: function (callback) {
                    if (!eqftp.utils.check.isFunction(callback)) {
                        callback = function () {};
                    }
                    if (_eqFTPPassword === false) {
                        eqftp._password.ask(function (error, password) {
                            if (error) {
                                eqftp._w(strings.warning__password_ask_cancel);
                            } else {
                                _eqFTPPassword = password;
                                callback(_eqFTPPassword);
                                return;
                            }
                        });
                    } else {
                        callback(_eqFTPPassword);
                        return;
                    }
                },
                ask: function (callback) {
                    if (!eqftp.utils.check.isFunction(callback)) {
                        callback = function () {};
                    }
                    var t = this,
                        promise = new Promise(function (done, fail) {
                            $('.eqftp-password').addClass('active');
                            if (eqftp.variables.password_error) {
                                $('.eqftp-password').addClass('eqftp-has-error');
                            } else {
                                $('.eqftp-password').removeClass('eqftp-has-error');
                            }
                            $('.eqftp-password .eqftp-password__input').focus();
                            t.done = function (params, event) {
                                if ((event.type === 'keyup' && event.keyCode === 13) || (event.type === 'click' && $(event.target).attr('eqftp-click'))) {
                                    done($('.eqftp-password .eqftp-password__input').val());
                                }
                            };
                            t.fail = fail;
                            t.close = function (params, event) {
                                done(false);
                                //fail;
                            };
                        });
                    promise.then(function (val) {
                        if (val !== false) {
                            $('.eqftp-password .eqftp-password__input').val('');
                            $('.eqftp-password').removeClass('active');
                            callback(false, val);
                        } else {
                            $('.eqftp-password .eqftp-password__input').val('');
                            $('.eqftp-password').removeClass('active');
                            eqftp.variables.password_error = false;
                        }
                    }).catch(function (error) {
                        $('.eqftp-password .eqftp-password__input').val('');
                        //$('.eqftp-password').removeClass('active');
                        callback(true, error);
                        return;
                    });
                }
            },
            _AES: {
                encrypt: function (input, passphrase) {
                    return JSON.parse(eqftp._AES._formatter.stringify(CryptoJS.AES.encrypt(JSON.stringify(input), passphrase)));
                },
                decrypt: function (input, passphrase) {
                    return CryptoJS.AES.decrypt(eqftp._AES._formatter.parse(JSON.stringify(input)), passphrase).toString(CryptoJS.enc.Utf8);
                },
                _formatter: {
                    stringify: function (cipherParams) {
                        // create json object with ciphertext
                        var jsonObj = {
                            ct: cipherParams.ciphertext.toString(CryptoJS.enc.Base64)
                        };
                        // optionally add iv and salt
                        if (cipherParams.iv) {
                            jsonObj.iv = cipherParams.iv.toString();
                        }
                        if (cipherParams.salt) {
                            jsonObj.s = cipherParams.salt.toString();
                        }
                        // stringify json object
                        return JSON.stringify(jsonObj);
                    },
                    parse: function (jsonStr) {
                        // parse json string
                        var jsonObj = JSON.parse(jsonStr);
                        // extract ciphertext from json object, and create cipher params object
                        var cipherParams = CryptoJS.lib.CipherParams.create({
                            ciphertext: CryptoJS.enc.Base64.parse(jsonObj.ct)
                        });
                        // optionally extract iv and salt
                        if (jsonObj.iv) {
                            cipherParams.iv = CryptoJS.enc.Hex.parse(jsonObj.iv);
                        }
                        if (jsonObj.s) {
                            cipherParams.salt = CryptoJS.enc.Hex.parse(jsonObj.s);
                        }
                        return cipherParams;
                    }
                }
            },
            _preferences: (function () {
                var t = {
                };
                t.init = false;
                t.p = (function () {
                    if (!t.init) {
                        t.init = PreferencesManager.getExtensionPrefs("eqFTP");
                    }
                    return t.init;
                }());
                t.get = function (preference, type, def) {
                    if (!type) {
                        type = "string";
                        preference = _.toString(preference);
                        if (!def) {
                            def = "";
                        }
                        def = _.toString(def);
                    }
                    t.p.definePreference(preference, type, def);
                    return t.p.get(preference);
                };
                t.set = function (preference, value) {
                    if (!preference || !value) {
                        t.p.set("eqFTP", eqftp.variables.eqFTP);
                    } else {
                        t.p.set(preference, value);
                    }
                    t.p.save();
                };
                return t;
            }()),
            _settings: {
                load: function (file_path, callback) {
                    eqftp.variables.last_settings_file_tmp = file_path;
                    if (!callback) {
                        callback = function (error, data) {
                            if (!error) {
                                _eqFTPSettings = data;
                                $('.eqftp-panel__settings_window__settings_file_input').val(file_path);
                                
                                eqftp.variables.eqFTP.misc.last_settings_file = file_path;
                                eqftp._preferences.set();
                                eqftp.ui.panel.settings_window.render();
                            }
                        };
                    }
                    if (!file_path) {
                        if (eqftp.variables.last_settings_file_tmp) {
                            file_path = eqftp.variables.last_settings_file_tmp;
                        } else if (eqftp.variables.eqFTP.misc.last_settings_file || eqftp.variables.eqFTP.misc.last_settings_file !== '') {
                            file_path = eqftp.variables.eqFTP.misc.last_settings_file;
                        } else {
                            callback(true);
                        }
                    }
                    _eqFTPPassword = false;
                    FileSystem.resolve(file_path, function (error, fileEntry, stats) {
                        if (!error) {
                            FileUtils.readAsText(fileEntry)
                                .done(function (text) {
                                    eqftp._settings.process(text, 'fromJSON', function (data) {
                                        if (data) {
                                            callback(false, data);
                                            return;
                                        } else {
                                            eqftp.variables.password_error = true;
                                            eqftp._settings.load();
                                            return;
                                        }
                                    });
                                })
                                .fail(function (error) {
                                    callback(true, error);
                                    return;
                                });
                        } else {
                            callback(true, error);
                            return;
                        }
                    });
                },
                save: function (file_path, settings, callback) {
                    if (!file_path) {
                        try {
                            if (eqftp.variables.eqFTP.misc.last_settings_file) {
                                file_path = eqftp.variables.eqFTP.misc.last_settings_file;
                            } else {
                                return false;
                            }
                        } catch (e) {
                            return false;
                        }
                    }
                    if (!callback && settings) {
                        callback = settings;
                        settings = undefined;
                    }
                    if (!settings) {
                        settings = _eqFTPSettings;
                    }
                    if (!callback) {
                        callback = function () {};
                    }
                    var fileEntry = new FileSystem.getFileForPath(file_path);
                    eqftp._settings.process(settings, 'toJSON', function (data) {
                        if (data) {
                            FileUtils.writeText(fileEntry, data, true)
                                .done(function () {
                                    eqftp.utils.log(strings.eqftp__log__settings__save_success, "success");
                                    callback(false, settings);
                                })
                                .fail(function (error) {
                                    eqftp._e(error, 'writeText');
                                    eqftp.utils.log(strings.eqftp__log__settings__save_fail, "error");
                                    callback(true, error);
                                });
                        }
                    });
                },
                create: function (file_path) {
                    if (file_path) {
                        eqftp._settings.save(file_path, eqftp.variables.defaults._eqFTPSettings, function (error, settings) {
                            if (!error) {
                                eqftp._settings.load(file_path);
                            }
                        });
                    }
                },
                process: function (data, direction, callback) {
                    data = _.cloneDeep(data);
                    if (!direction || !data) {
                        if (eqftp.utils.check.isFunction(callback)) {
                            callback(false);
                            return;
                        } else {
                            return false;
                        }
                    }
                    switch (direction) {
                    case 'toJSON':
                        if (!eqftp.utils.check.isObject(data)) {
                            eqftp._e(strings.error__settings_process_toJSON_not_object);
                            if (eqftp.utils.check.isFunction(callback)) {
                                callback(false);
                                return;
                            } else {
                                return false;
                            }
                        } else {
                            if (data.misc.encrypted === true) {
                                eqftp._password.get(function (password) {
                                    data.connections = eqftp._AES.encrypt(data.connections, password);
                                    data = JSON.stringify(data);
                                    if (eqftp.utils.check.isFunction(callback)) {
                                        callback(data);
                                        return;
                                    }
                                });
                            } else {
                                data = JSON.stringify(data);
                                if (eqftp.utils.check.isFunction(callback)) {
                                    callback(data);
                                    return;
                                }
                            }
                        }
                        break;
                    case 'fromJSON':
                        if (!eqftp.utils.check.isString(data)) {
                            eqftp._e(strings.error__settings_process_fromJSON_not_string);
                            if (eqftp.utils.check.isFunction(callback)) {
                                callback(false);
                                return;
                            } else {
                                return false;
                            }
                        } else {
                            if (!eqftp.utils.check.isJSON(data)) {
                                eqftp._e(strings.error__settings_process_fromJSON_not_json);
                            } else {
                                data = JSON.parse(data);
                                if (data.misc.encrypted === true) {
                                    eqftp._password.get(function (password) {
                                        data.connections = eqftp._AES.decrypt(data.connections, password);
                                        if (eqftp.utils.check.isJSON(data.connections)) {
                                            data.connections = JSON.parse(data.connections);
                                            eqftp.variables.password_error = false;
                                            if (eqftp.utils.check.isFunction(callback)) {
                                                callback(data);
                                                return;
                                            }
                                        } else {
                                            if (eqftp.utils.check.isFunction(callback)) {
                                                callback(false);
                                                return;
                                            }
                                        }
                                    });
                                } else if (eqftp.utils.check.isFunction(callback)) {
                                    callback(data);
                                    return;
                                }
                            }
                        }
                        break;
                    }
                    if (!eqftp.utils.check.isFunction(callback)) {
                        return data;
                    }
                },
                _init: function () {
                    if (eqftp.variables.eqFTP.misc.last_settings_file) {
                        eqftp._settings.load(eqftp.variables.eqFTP.misc.last_settings_file); // TODO Add default resetter after loading settings
                    }
                }
            },
            _init: function () {
                eqftp.variables.ui.content.after(tpl__panel);
                eqftp.variables.eqFTP = eqftp._preferences.get("eqFTP", "object", {
                    misc: {
                        first_start: true,
                        last_settings_file: ''
                    }
                });
                eqftp._settings._init();
            },
            variables: {
                eqFTP: {},
                version: _version,
                password_error: false,
                defaults: {
                    main_view__content__right: 30,
                    panel__width: 300,
                    _eqFTPSettings: {
                        main: {
                            projects_folder: _homeFolder,
                            date_format: "dd.mm.yyyy",
                            debug: false,
                            open_project_connection: false
                        },
                        misc: {
                            version: _version,
                            encrypted: false
                        },
                        local_paths: [],
                        connections_data: [],
                        connections: []
                    }
                },
                ui: {
                    content: $('.main-view .content'),
                    eqftp_panel: $(".eqftp-panel"),
                    eqftp_panel__server_list: '.eqftp-panel__server_dropdown_holder'
                },
                functions: {
                    "set_projects_folder": function (result) {
                        if (result) {
                            _eqFTPSettings.main.projects_folder = result;
                            eqftp.ui.panel.settings_window.utils._setValue(['main', 'projects_folder']);
                            eqftp._settings.save();
                        }
                    },
                    "set_ofd_value": function (result, params, e) {
                        if (result) {
                            $(e.target).val(result);
                        } else if (params.allow_empty) {
                            $(e.target).val('');
                        }
                    },
                    "set_connection_localpath": function (result, params, e) {
                        $(e.target).attr('data-changed', 'true');
                        // TODO : Add check for duplicate localpath
                        if (result) {
                            $(e.target).val(result);
                        }
                    },
                    "load_settings_from_file": function (result) {
                        if (result) {
                            eqftp._settings.load(result);
                        }
                    },
                    "editNewConnection": function (clone) {
                        clone.find('.eqftp-accordion-toggle').click();
                        clone.find('#eqftp-connection__name').focus();
                        clone.find('#eqftp-connection__localpath').val(eqftp.utils.normalize(_eqFTPSettings.main.projects_folder + '/' + strings.eqftp__connection__name_placeholder));
                    }
                }
            },
            _e: function (text, errtype, error) {
                // prints error in log
                console.error(text);
                if (errtype) {
                    var params = {
                        title: '[v' + _version + '][AutoError] ',
                        body: 'This is automatically compiled error message. '
                    };
                    switch (errtype) {
                        case 'writeText':
                        params.title += 'FileUtils.writeText returning error';
                        if (eqftp.utils.check.isString(text)) {
                            params.body += text;
                        } else if (eqftp.utils.check.isArray(text) || eqftp.utils.check.isObject(text)) {
                            params.body += JSON.stringify(text);
                        }
                        break;
                    /*
                    case 'passAskFail':
                        params.title = 'Password dialog fails';
                        params.body = 'For some reason password dialog fails';
                        if (error) {
                            params.body += ' with error: "' + error + '"';
                        }
                        params.body += "\n\nPlease help me fix this problem.";
                        break;
                    */
                    }
                    params = $.param(params);
                    var link = 'https://github.com/Equals182/eqFTP/issues/new?' + params;
                    console.log('Please follow this link to create an issue: ' + link);
                }
            },
            _w: function (text) {
                // prints error in log
                console.warn(text);
            }
        };
    
    AppInit.htmlReady(function () {
        ExtensionUtils.loadStyleSheet(module, "styles/ext.css");
        $("#main-toolbar .buttons").append(tpl__toolbar);
        
        $('body').on('click', '[eqftp-click]', function (e) {
            e.preventDefault();
            eqftp.utils.action($(this).attr('eqftp-click'), e);
        });
        $('body').on('mouseenter', '[eqftp-mouseenter]', function (e) {
            e.preventDefault();
            eqftp.utils.action($(this).attr('eqftp-mouseenter'), e);
        });
        $('body').on('mouseleave', '[eqftp-mouseleave]', function (e) {
            e.preventDefault();
            eqftp.utils.action($(this).attr('eqftp-mouseleave'), e);
        });
        $('body').on('keyup', '[eqftp-keyup]', function (e) {
            eqftp.utils.action($(this).attr('eqftp-keyup'), e);
        });
        $('body').on('click', function (e) {
            var t = e.target,
                protector = $(t).closest('.eqftp-hide_on_click_anywhere_else__protector');
            if (protector.length === 0) {
                $('.eqftp-hide_on_click_anywhere_else').hide();
            } else {
                var protect = $('body');
                if (protector.attr('eqftp-hocae_protect')) {
                    protect = $(protector.attr('eqftp-hocae_protect'));
                } else {
                    var p = protector.find('.eqftp-hide_on_click_anywhere_else');
                    if (p.length > 0) {
                        protect = p;
                    }
                }
                $('.eqftp-hide_on_click_anywhere_else').not(protect).hide();
            }
        });
        $('body').on('mousedown', '[eqftp-mousedown]', function () {
            if ($(this).attr('eqftp-mousedown') === 'resize') {
                var target = $(this),
                    sticker = null;
                if ($(this).attr('eqftp-resize-target')) {
                    target = $($(this).attr('eqftp-resize-target'));
                }
                if ($(this).attr('eqftp-resize-sticker')) {
                    sticker = $($(this).attr('eqftp-resize-sticker'));
                }
                eqftp.utils.resize.srv.down($(target).get(0), sticker);
            }
        });
        document.onmouseup   = eqftp.utils.resize.srv.up;
        document.onmousemove = eqftp.utils.resize.srv.move;
        
    });
    
    AppInit.appReady(function () {
        $("#main-toolbar .buttons .eqftp-toolbar__icon.disabled").removeClass('disabled');
        eqftp._init();
    });
});