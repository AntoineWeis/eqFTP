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
        NodeConnection = brackets.getModule("utils/NodeConnection"),
        EventEmitter = require('events/index'),
        
        strings = require("strings"),
        CryptoJS = require("crypto-js/crypto-js"),
        dateFormat = require("date-format/date_format"),
        
        _ = require("node/node_modules/lodash/lodash"),
        
        tpl__toolbar = Mustache.render(require("text!htmlContent/toolbar.html"), strings),
        tpl__panel = Mustache.render(require("text!htmlContent/panel.html"), strings),
        tpl__panel__searchDropdown__outer = Mustache.render(require("text!htmlContent/panel__searchDropdown--outer.html"), strings),
        tpl__panel__searchDropdown__row = Mustache.render(require("text!htmlContent/panel__searchDropdown--row.html"), strings),
        
        tpl__file_tree__element_folder = Mustache.render(require("text!htmlContent/file_tree--folder.html"), strings),
        tpl__file_tree__element_symlink = Mustache.render(require("text!htmlContent/file_tree--symlink.html"), strings),
        tpl__file_tree__element_file = Mustache.render(require("text!htmlContent/file_tree--file.html"), strings),
        
        _defaultEqFTPFolder = brackets.app.getUserDocumentsDirectory(),
        _homeFolder = _defaultEqFTPFolder,
        _eqFTPSettings = {},
        _eqFTPPassword = false,
        _eqFTPCache = {
            connection_contents: {},
            connection_info: {},
            connection_queue: {},
            connection_temp: {},
            connection_temp_files: {},
            file_tree: {
                sorting: {
                    sort: 'alpabetical',
                    direction: 'asc',
                    all_sorts: ['alpabetical', 'size', 'date_modified']
                }
            }
        },
        _node;
    EventEmitter = new EventEmitter();
    
    var _version = "0.8.0",
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
                                        _.forOwn(_eqFTPSettings.connections, function (value, key) {
                                            out += eqftp.utils.render(tpl__panel__searchDropdown__row, {
                                                id: key,
                                                title: value.name,
                                                host: value.server,
                                                user: value.login
                                            });
                                        });
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
                                },
                                _connect: function (params, e) {
                                    if (!params.connection_id) {
                                        eqftp._e('No connection_id found');
                                        return false;
                                    }
                                    $(eqftp.variables.ui.eqftp_panel__server_list).slideUp(80);
                                    eqftp.connections.ls(params.connection_id);
                                }
                            },
                            mode: {
                                filter: function (params, e) {
                                    var key = e.keyCode,
                                        v = $(e.target).val();
                                    if (key === 13) {
                                        /* ENTER KEY PRESSED */
                                        var connection = eqftp.utils.parse_connection_string({
                                            connection_string: v
                                        });
                                        if (connection) {
                                            var id = eqftp.utils.uniq();
                                            _eqFTPCache.connection_temp[id] = {
                                                name: strings.eqftp__connection__temporary_prefix + connection.domain,
                                                server: connection.domain,
                                                protocol: connection.protocol || (connection.port === 22 ? 'sftp' : 'ftp'),
                                                port: connection.port || 21,
                                                password: connection.password,
                                                login: connection.login || 'anonymous',
                                                localpath: _eqFTPSettings.main.projects_folder,
                                                remotepath: undefined,
                                                autoupload: true,
                                                keep_alive: 10,
                                                ignore_list: '',
                                                rsa: '',
                                                check_difference: true,
                                                is_temporary: true,
                                                id: id
                                            };
                                            $(eqftp.variables.ui.eqftp_panel__server_list).slideUp(80);
                                            eqftp.connections.ls(id);
                                        }
                                    } else {
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
                                    return false;
                                } else {
                                    // Okay
                                    eqftp._settings.create(result);
                                    return true;
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
                            settings_reload: function (params, e) {
                                eqftp._settings._init();
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
                                _.forOwn(_eqFTPSettings.connections, function (value, key) {
                                    if ($('*[name^="eqftpSettings[connections][' + key + ']"]').length === 0) {
                                        _.unset(_eqFTPSettings, ['connections', key]);
                                    } else {
                                        if (!value.localpath) {
                                            _eqFTPSettings.connections[key].localpath = eqftp.utils.normalize(_eqFTPSettings.main.projects_folder + '/' + (value.name || key));
                                        }
                                        _eqFTPSettings.localpaths[key] = _eqFTPSettings.connections[key].localpath;
                                    }
                                });
                                eqftp._settings.save();
                            },
                            _setValue: function (path, donor) {
                                if (!donor) {
                                    donor = _eqFTPSettings;
                                }
                                if (eqftp.utils.check.isString(path)) {
                                    path = path.match(/([A-Za-z0-9\-\_]+)/gmi);
                                    path = _.tail(path);
                                }
                                if (!eqftp.utils.check.isArray(path) || !eqftp.utils.check.isObject(donor)) {
                                    return false;
                                }
                                if (!eqftp.utils.check.isArray(path)) {
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
                                    case 'password':
                                    case 'text':
                                        selector.val(tmp);
                                        break;
                                    default:
                                        if (selector.is('select')) {
                                            selector.find('option[value="' + tmp + '"]').prop('selected', true);
                                            selector.change();
                                        }
                                        break;
                                    }
                                }
                            },
                            write_connections_name: function (params, e) {
                                var group = $(e.target).closest('.eqftp-accordion-group'),
                                    input = group.find('#eqftp-connection__name'),
                                    header = group.find('.eqftp-accordion-heading .eqftp-connection-name'),
                                    val = input.val() || strings.eqftp__connection__name_placeholder;
                                header.text(val);
                                var lp = group.find('#eqftp-connection__localpath');
                                if (lp.attr('data-changed') === 'false') {
                                    lp.val(eqftp.utils.normalize(_eqFTPSettings.main.projects_folder + '/' + val));
                                }
                            },
                            parse_connection_string: function (params, e) {
                                var group = $(e.target).closest('.eqftp-accordion-group'),
                                    s = $(e.target).val(),
                                    r = eqftp.utils.parse_connection_string({
                                        connection_string: s
                                    });
                                if (r) {
                                    if (r.protocol) {
                                        r.protocol = r.protocol.toLowerCase();
                                        if (r.protocol === 'ftp' || r.protocol === 'sftp') {
                                            group.find('#eqftp-connection__protocol').val(r.protocol);
                                            group.find('#eqftp-connection__protocol').change();
                                        }
                                    }
                                    if (r.login) {
                                        group.find('#eqftp-connection__login').val(r.login);
                                    }
                                    if (r.password) {
                                        group.find('#eqftp-connection__password').val(r.password);
                                    }
                                    if (r.domain) {
                                        group.find('#eqftp-connection__server').val(r.domain);
                                    }
                                    if (r.port) {
                                        group.find('#eqftp-connection__port').val(r.port);
                                    }
                                }
                            },
                            change_mode: function (params, e) {
                                var v = $(e.target).val().toLocaleString();
                                if (v === 'sftp' || v === 'ftp') {
                                    $(e.target).closest('.eqftp-accordion-group').removeClass('eqftp-sftp eqftp-ftp').addClass('eqftp-' + v);
                                }
                            }
                        },
                        render: function () {
                            this.utils._setValue(['misc', 'encrypted']);
                            this.utils._setValue(['main', 'projects_folder']);
                            this.utils._setValue(['main', 'date_format']);
                            
                            $('#eqftp-connections-list').html('');
                            _.forOwn(_eqFTPSettings.connections, function (value, key) {
                                eqftp.ui.clone({
                                    from: "#eqftp-connection-donor>div",
                                    to: "#eqftp-connections-list",
                                    callback: function (clone) {
                                        clone.find('*[name]').each(function () {
                                            var name = 'eqftpSettings' + $(this).attr('name');
                                            name = name.replace(/\{\$i\}/gmi, key);
                                            $(this).attr('name', name);
                                            eqftp.ui.panel.settings_window.utils._setValue(name);
                                        });
                                        clone.find('.eqftp-connection-name').text(value.name);
                                    }
                                });
                            });
                        }
                    },
                    file_tree: {
                        render: function (params, e) {
                            if (!params.connection_id || !_eqFTPCache.connection_contents[params.connection_id]) {
                                return false;
                            }
                            if (!$('.eqftp-file_tree--holder')[0].onscroll) {
                                $('.eqftp-file_tree--holder')[0].onscroll = function () {
                                    eqftp.ui.panel.file_tree._fix_opened(false, {target: $('.eqftp-file_tree--holder')});
                                };
                            }
                            if (!params.path) {
                                var keys = Object.keys(_eqFTPCache.connection_contents[params.connection_id]);
                                keys.sort(function (a, b) {
                                    return a.length - b.length;
                                });
                                eqftp.ui.panel.file_tree._render_single({
                                    contents: _eqFTPCache.connection_contents[params.connection_id][_eqFTPCache.connection_info[params.connection_id].start_path],
                                    parent: $('.eqftp-file_tree'),
                                    connection_id: params.connection_id
                                });
                                keys.forEach(function (e, i) {
                                    if (e !== _eqFTPCache.connection_info[params.connection_id].start_path) {
                                        if ($('[eqftp-tree_path="' + e + '"]').length === 1) {
                                            eqftp.ui.panel.file_tree._render_single({
                                                contents: _eqFTPCache.connection_contents[params.connection_id][e],
                                                parent: $('[eqftp-tree_path="' + e + '"]').closest('.eqftp-file_tree-element').find('.eqftp-file_tree-subfolder:first'),
                                                connection_id: params.connection_id
                                            });
                                        }
                                    }
                                });
                            } else {
                                if ($('[eqftp-tree_path="' + params.path + '"]').length === 1) {
                                    eqftp.ui.panel.file_tree._render_single({
                                        contents: _eqFTPCache.connection_contents[params.connection_id][params.path],
                                        parent: $('[eqftp-tree_path="' + params.path + '"]').closest('.eqftp-file_tree-element').find('.eqftp-file_tree-subfolder:first'),
                                        connection_id: params.connection_id
                                    });
                                }
                            }
                        },
                        sorts: {
                            alpabetical: function (a, b) {
                                var nameA = a.filename.toLowerCase(),
                                    nameB = b.filename.toLowerCase();
                                //sort string ascending
                                if (nameA < nameB) {
                                    return -1;
                                }
                                if (nameA > nameB) {
                                    return 1;
                                }
                                return 0; //default return value (no sorting)
                            }
                        },
                        open_folder: function (params, e) {
                            var t = $(e.target).closest('.eqftp-file_tree-element'),
                                sf = $(t).children('.eqftp-file_tree-subfolder'),
                                path = t.find('[eqftp-tree_path]:first').attr('eqftp-tree_path');
                            $(t).addClass('eqftp-loading');
                            if (_eqFTPCache.connection_contents[params.connection_id] && _eqFTPCache.connection_contents[params.connection_id][path]) {
                                if (_eqFTPCache.connection_contents[params.connection_id][path].status === 'opened') {
                                    _eqFTPCache.connection_contents[params.connection_id][path].status = 'closed';
                                    $(t).removeClass('eqftp-opened');
                                    $(sf).slideUp(200);
                                    $(t).removeClass('eqftp-loading');
                                } else {
                                    _eqFTPCache.connection_contents[params.connection_id][path].status = 'opened';
                                    $(t).addClass('eqftp-opened');
                                    $(sf).slideDown(200);
                                    $(t).removeClass('eqftp-loading');
                                }
                            } else {
                                eqftp.connections.ls(params.connection_id, path, 'single');
                            }
                        },
                        open_file: function (params, e) {
                            var t = $(e.target).closest('.eqftp-file_tree-element'),
                                path = t.find('[eqftp-tree_path]:first').attr('eqftp-tree_path');
                            eqftp.connections.download({
                                remotepath: path,
                                connection_id: params.connection_id,
                                callback: function (result) {
                                    console.log(result);
                                },
                                queue: 'auto'
                            });
                        },
                        _fix_opened: function (params, e) {
                            _.delay(function () {
                                var ft = $(e.target).closest('.eqftp-file_tree--holder'),
                                    bl = ft.offset().top,
                                    ds = [];
                                ft.find('.eqftp-opened').each(function () {
                                    var t = $(this),
                                        d = t.offset().top - bl,
                                        db = d + t.outerHeight();
                                    if (d < 0 && db > 0) {
                                        ds.push({
                                            d: d,
                                            t: t
                                        });
                                    }
                                });
                                if (ds.length > 0) {
                                    ds.sort(function (a, b) {
                                        return b.d - a.d;
                                    });
                                    var ed = $(ds[0].t).children('.eqftp-file_tree-element_data'),
                                        pl = $(ed).offset().left - ft.offset().left,
                                        c = $(ed).clone(true);
                                    c.css('padding-left', pl + 'px');
                                    $('.eqftp-fixed_folder').html(c);
                                } else {
                                    $('.eqftp-fixed_folder').html('');
                                }
                            }, 10);
                        },
                        _render_single: function (params) {
                            var html = {};
                            if (params.contents && params.contents.contents && eqftp.utils.check.isArray(params.contents.contents)) {
                                params.contents.contents.sort(eqftp.ui.panel.file_tree.sorts[_eqFTPCache.file_tree.sorting.sort]);
                                if (_eqFTPCache.file_tree.sorting.direction === 'desc') {
                                    params.contents.contents = _.reverse(params.contents.contents);
                                }
                                params.contents.contents.forEach(function (e, i) {
                                    if (!html[e.type]) {
                                        html[e.type] = '';
                                    }
                                    var ext = eqftp.utils.extract_extension(e.filename);
                                    switch (e.type) {
                                    case 'd':
                                        html[e.type] += eqftp.utils.render(tpl__file_tree__element_folder, {
                                            name: e.filename,
                                            datemodified: dateFormat(_eqFTPSettings.main.date_format, new Date(e.date)),
                                            datemodified_o: e.date,
                                            path: e.full_path,
                                            connid: params.connection_id
                                        }, 'element_');
                                        break;
                                    case 'l':
                                        html.d += eqftp.utils.render(tpl__file_tree__element_symlink, {
                                            name: e.filename,
                                            name_s: e.filename.replace(/(.+)(\..*?)$/, '$1<span class="eqftp-extension">$2</span>'),
                                            extension: (ext ? 'ext-' + ext : ''),
                                            datemodified: dateFormat(_eqFTPSettings.main.date_format, new Date(e.date)),
                                            datemodified_o: e.date,
                                            path: e.full_path,
                                            size: eqftp.utils.humanize_filesize(e.size),
                                            connid: params.connection_id
                                        }, 'element_');
                                        break;
                                    default:
                                        html[e.type] += eqftp.utils.render(tpl__file_tree__element_file, {
                                            name: e.filename,
                                            name_s: e.filename.replace(/(.+)(\..*?)$/, '$1<span class="eqftp-extension">$2</span>'),
                                            extension: (ext ? 'ext-' + ext : ''),
                                            datemodified: dateFormat(_eqFTPSettings.main.date_format, new Date(e.date)),
                                            datemodified_o: e.date,
                                            path: e.full_path,
                                            size: eqftp.utils.humanize_filesize(e.size),
                                            connid: params.connection_id
                                        }, 'element_');
                                        break;
                                    }
                                });
                            }
                            var t = params.parent.closest('.eqftp-file_tree-element');
                            $(t).addClass('eqftp-opened').removeClass('eqftp-loading');
                            params.parent.html((html.d || '') + (html.f || ''));
                            $(t).children('.eqftp-file_tree-subfolder').slideDown(200);
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
                },
                toggle: {
                    class: function (params, e) {
                        switch (params.relativity) {
                        case 'closest':
                            $(e.target).closest(params.target).toggleClass(params.class);
                            break;
                        default:
                            $(params.target).toggleClass(params.class);
                            break;
                        }
                    }
                },
                remove_element: function (params, e) {
                    switch (params.relativity) {
                    case 'closest':
                        $(e.target).closest(params.target).remove();
                        break;
                    default:
                        $(params.target).remove();
                        break;
                    }
                }
            },
            utils: {
                do: function (path, params, event, returnit) {
                    var tmp = eqftp;
                    path.some(function (o, n) {
                        if (eqftp.utils.check.isObject(tmp[o])) {
                            tmp = tmp[o];
                        } else if (eqftp.utils.check.isFunction(tmp[o])) {
                            if (returnit) {
                                return tmp[o];
                            }
                            tmp[o](params, event);
                            return true;
                        } else {
                            if (returnit) {
                                return function () {};
                            }
                            return true;
                        }
                    });
                },
                // accepts string `path__to__method--parameter=value;second=foobar` excluding eqftp in start
                action: function (action, event, returnit) {
                    var actions = action.split('--'),
                        methods = actions[0].split('__'),
                        args = {};
                    if (!!actions[1]) {
                        var arguments_pairs = actions[1].split(';');
                        arguments_pairs.forEach(function (pair, n) {
                            pair = pair.split('=');
                            args[pair[0]] = pair[1];
                        });
                    }
                    eqftp.utils.do(methods, args, event, returnit);
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
                        return getType.toString.call(input) === '[object String]';
                    },
                    isArray: function (input) {
                        return _.isArray(input);
                    },
                    isNumeric: function (input) {
                        return _.isNumber(input) && !isNaN(input);
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
                        if (!prefix) {
                            prefix = '';
                        }
                        _.forOwn(params, function (e, i) {
                            if (eqftp.utils.check.isObject(e)) {
                                tpl = eqftp.utils.render(tpl, e, prefix + i + '.');
                            } else {
                                if (!eqftp.utils.check.isString(e) && !eqftp.utils.check.isNumeric(e)) {
                                    e = '';
                                }
                                var str = eqftp.utils.escape('[[' + prefix + i + ']]'),
                                    r = new RegExp(str, 'g');
                                tpl = tpl.replace(r, e);
                                return tpl;
                            }
                        });
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
                parse_connection_string: function (params, e) {
                    if (!params.connection_string || !eqftp.utils.check.isString(params.connection_string)) {
                        return false;
                    }
                    var m = params.connection_string.match(/((ftp|sftp):\/\/)?((.*?)(:(.*?))?@)?([A-Z\.\-\_a-z0-9]+)(:(\d+))?/i);
                    /*
                    ** $2 - protocol
                    ** $4 - login
                    ** $6 - password
                    ** $7 - domain
                    ** $9 - port
                    */
                    if (!m) {
                        return false;
                    }
                    if (!m[4] || !m[7]) {
                        return false;
                    }
                    return {
                        protocol: m[2],
                        login: m[4],
                        password: m[6],
                        domain: m[7],
                        port: m[9]
                    };
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
                },
                chain: function () {
                    var functions = Array.prototype.slice.call(arguments, 0);
                    if (functions.length > 0) {
                        var firstFunction = functions.shift(),
                            firstPromise = firstFunction.call();
                        firstPromise.done(function () {
                            eqftp.utils.chain.apply(null, functions);
                        });
                    }
                },
                md5: function (value) {
                    return CryptoJS.MD5(value).toString();
                },
                humanize_filesize: function (value, decimals) {
                    if (!decimals) {
                        decimals = 1;
                    }
                    if (value === 0) { return '0 ' + strings.eqftp__filesize_bytes; }
                    var k = 1000, // or 1024 for binary
                        dm = decimals + 1 || 3,
                        sizes = [
                            strings.eqftp__filesize_bytes,
                            strings.eqftp__filesize_kilobytes,
                            strings.eqftp__filesize_megabytes,
                            strings.eqftp__filesize_gigabytes,
                            strings.eqftp__filesize_terabytes,
                            strings.eqftp__filesize_petabytes,
                            strings.eqftp__filesize_exabytes,
                            strings.eqftp__filesize_zettabytes,
                            strings.eqftp__filesize_yottabytes
                        ],
                        i = Math.floor(Math.log(value) / Math.log(k));
                    return parseFloat((value / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
                },
                extract_extension: function (filename) {
                    if (!eqftp.utils.check.isString(filename)) {
                        return false;
                    }
                    var m = filename.match(/.+\.(.*?)$/);
                    if (!m) {
                        return false;
                    }
                    return m[1];
                },
                log: function (text, type) {
                    if (!text) {
                        return false;
                    }
                    var match = text.match(/^$(.*)/);
                    if (match) {
                        text = strings[match[1]];
                    }
                    if (!type) {
                        type = "info";
                    }
                    var time = dateFormat('hh:mm', new Date());
                    $(".eqftp-infofooter--msgholder").append('<div class="eqftp-infofooter--msg eqftp-infofooter--' + type + '"><span class="eqftp-infofooter--time">' + time + '</span><span>' + text + '</span></div>');
                }
            },
            connections: {
                _getByID: function (id) {
                    if (!id) {
                        return false;
                    }
                    if (_eqFTPCache.connection_temp && _eqFTPCache.connection_temp[id]) {
                        return eqftp.connections._fillParams(_eqFTPCache.connection_temp[id]);
                    }
                    if (!_eqFTPSettings.connections || !_eqFTPSettings.connections[id]) {
                        eqftp._e('No Connection found with given connection_id OR no connections found in current settings file. Reload setting file and try again.');
                        return false;
                    }
                    return eqftp.connections._fillParams(_eqFTPSettings.connections[id]);
                },
                _fillParams: function (connection) {
                    _.forOwn(_eqFTPSettings.connections, function (value, key) {
                        if (value === connection) {
                            connection.id = key;
                            return false;
                        }
                    });
                    if (!connection.connection_hash) {
                        connection.connection_hash = eqftp.utils.md5(connection.protocol + connection.server + connection.port + connection.login);
                    }
                    return connection;
                },
                cd: function (connection_id, path) {
                    if (!connection_id) {
                        return false;
                    }
                    var connection = eqftp.connections._getByID(connection_id);
                    if (!connection) {
                        return false;
                    }
                    eqftp.domain.do(['ftp', 'cd'], {
                        connection: connection,
                        path: path || connection.remotepath
                    }, function (result) {
                        console.log(result);
                    });
                },
                ls: function (connection_id, path, render_mode) {
                    if (!connection_id) {
                        return false;
                    }
                    if (!render_mode) {
                        render_mode = 'all';
                    }
                    var connection = eqftp.connections._getByID(connection_id);
                    if (!connection) {
                        return false;
                    }
                    eqftp.domain.do(['ftp', 'ls'], {
                        connection: connection,
                        path: path || connection.remotepath
                    }, function (result) {
                        if (result) {
                            if (!_eqFTPCache.connection_info[result.params.connection.id]) {
                                _eqFTPCache.connection_info[result.params.connection.id] = {};
                            }
                            if (!_eqFTPCache.connection_info[result.params.connection.id].start_path) {
                                _eqFTPCache.connection_info[result.params.connection.id].start_path = connection.remotepath || '';
                                if (!_eqFTPCache.connection_info[result.params.connection.id].start_path.match(/^\//)) {
                                    _eqFTPCache.connection_info[result.params.connection.id].start_path = result.params.start_path + '/' + _eqFTPCache.connection_info[result.params.connection.id].start_path;
                                }
                                _eqFTPCache.connection_info[result.params.connection.id].start_path = eqftp.utils.normalize(_eqFTPCache.connection_info[result.params.connection.id].start_path + '/');
                            }
                            if (!_eqFTPCache.connection_contents[result.params.connection.id]) {
                                _eqFTPCache.connection_contents[result.params.connection.id] = {};
                            }
                            if (eqftp.utils.check.isArray(result.contents)) {
                                _eqFTPCache.connection_contents[result.params.connection.id][result.params.path] = {
                                    status: ((render_mode !== 'none') ? "opened" : "closed"),
                                    contents: []
                                };
                                result.contents.forEach(function (v, i) {
                                    if (!v.full_path) {
                                        v.full_path = eqftp.utils.normalize(result.params.path + '/' + v.name);
                                    }
                                    _eqFTPCache.connection_contents[result.params.connection.id][result.params.path].contents.push(v);
                                });
                                switch (render_mode) {
                                case 'all':
                                    eqftp.ui.panel.file_tree.render({
                                        connection_id: result.params.connection.id
                                    });
                                    break;
                                case 'single':
                                    eqftp.ui.panel.file_tree.render({
                                        connection_id: result.params.connection.id,
                                        path: result.params.path
                                    });
                                    break;
                                }
                            }
                        }
                    });
                },
                _run_queue: function (connection_id) {
                    var connection = eqftp.connections._getByID(connection_id);
                    if (!connection) {
                        return false;
                    }
                    if (_eqFTPCache.connection_queue[connection_id] && !_eqFTPCache.connection_queue[connection_id].is_busy) {
                        if (_eqFTPCache.connection_queue[connection_id].auto && _eqFTPCache.connection_queue[connection_id].auto.length > 0) {
                            _eqFTPCache.connection_queue[connection_id].is_busy = true;
                            
                            var queuer = _eqFTPCache.connection_queue[connection_id].auto.splice(0, 1);
                            queuer = _.assignIn(queuer[0], {status: 'progress'});
                            _eqFTPCache.connection_queue[connection_id].done.push(queuer);
                            eqftp.emit('event', {
                                action: 'queue:update',
                                connection_id: connection_id
                            });
                            eqftp.domain.do(['ftp', 'download'], {
                                connection: connection,
                                queuer: queuer
                            }, function (result) {
                                _eqFTPCache.connection_queue[connection_id].is_busy = false;
                                queuer.callback(result);
                            });
                        } else {
                            _eqFTPCache.connection_queue[connection_id].is_busy = false;
                        }
                    }
                },
                start_paused: function (connection_id) {
                    var connection = eqftp.connections._getByID(connection_id);
                    if (!connection) {
                        return false;
                    }
                    if (_eqFTPCache.connection_queue[connection_id]) {
                        _eqFTPCache.connection_queue[connection_id].auto = _.concat(_eqFTPCache.connection_queue[connection_id].auto, _eqFTPCache.connection_queue[connection_id].paused);
                        _eqFTPCache.connection_queue[connection_id].paused = [];
                        eqftp.connections._run_queue(connection_id);
                        _eqFTPCache.connection_queue[connection_id].auto.forEach(function (v, i) {
                            _eqFTPCache.connection_queue[connection_id].auto[i].status = 'waiting';
                        });
                    }
                    eqftp.emit('event', {
                        action: 'queue:update',
                        connection_id: connection_id
                    });
                },
                download: function (params) {
                    //connection_id, remotepath, callback, queue
                    if (!params || !params.connection_id || !params.remotepath) {
                        return false;
                    }
                    if (!params.callback) {
                        params.callback = function () {};
                    }
                    if (!params.queue) {
                        params.queue = 'auto';
                    }
                    var connection = eqftp.connections._getByID(params.connection_id);
                    if (!connection) {
                        return false;
                    }
                    if (!_eqFTPCache.connection_queue[params.connection_id]) {
                        _eqFTPCache.connection_queue[params.connection_id] = {
                            auto: [],
                            done: [],
                            paused: [],
                            is_busy: false
                        };
                    }
                    var localpath = '',
                        status = 'waiting',
                        queuer_id = eqftp.utils.uniq();
                    switch (params.queue) {
                    case 'auto':
                      status = params.status || 'waiting';
                      break;
                    case 'done':
                      status = params.status || 'done';
                      break;
                    case 'paused':
                      status = params.status || 'paused';
                      break;
                    }
                    var cb = params.callback || function () {};
                    if (connection.is_temporary) {
                        localpath = eqftp.utils.normalize(connection.localpath + '/tmp_' + connection.id + '_' + eqftp.utils.uniq() + '.eqftp');
                        params.callback = function (_params) {
                            // Add to tmp list
                            if (!_eqFTPCache.connection_temp_files[params.connection_id]) {
                                _eqFTPCache.connection_temp_files[params.connection_id] = [];
                            }
                            _eqFTPCache.connection_temp_files[params.connection_id].push({
                                localpath: localpath,
                                remotepath: params.remotepath
                            });
                            if (eqftp.utils.check.isFunction(cb)) {
                                cb(_params);
                            }
                        };
                    } else {
                        params.callback = function (_params) {
                            _eqFTPCache.connection_queue[params.connection_id].done.forEach(function (v, i) {
                                if (v._id === queuer_id) {
                                    if (params) {
                                        _eqFTPCache.connection_queue[params.connection_id].done[i].status = 'done';
                                    } else {
                                        _eqFTPCache.connection_queue[params.connection_id].done[i].status = 'failed';
                                    }
                                    console.log('DONE', _eqFTPCache.connection_queue[params.connection_id].done[i]);
                                }
                            });
                            if (eqftp.utils.check.isFunction(cb)) {
                                cb(_params);
                            }
                        };
                        localpath = eqftp.utils.normalize(connection.localpath + '/' + params.remotepath.replace(connection.start_path, ''));
                    }
                    _eqFTPCache.connection_queue[params.connection_id][params.queue].push({
                        _id: queuer_id,
                        direction: 'download',
                        localpath: localpath,
                        remotepath: params.remotepath,
                        status: status,
                        callback: params.callback
                    });
                    eqftp.emit('event', {
                        action: 'queue:update',
                        connection_id: params.connection_id
                    });
                },
                upload: function (connection_id, local_path) {
                    if (!connection_id || !local_path) {
                        return false;
                    }
                    if (!_eqFTPCache.connection_queue[connection_id]) {
                        _eqFTPCache.connection_queue[connection_id] = {
                            q: [],
                            is_busy: false
                        };
                    }
                    _eqFTPCache.connection_queue[connection_id].q.push({
                        direction: 'upload'
                    });
                }
            },
            domain: {
                do: function (path, params, callback) {
                    params._id = eqftp.utils.uniq();
                    if (callback) {
                        eqftp.variables.callbacks[params._id] = callback;
                    }
                    _node.domains.eqFTP._do(path, params);
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
                                eqftp.ui.panel.toolbar.search.dropdown.render('rerender');
                                eqftp.utils.log(strings.eqftp__log__settings__load_success, 'info');
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
                                    eqftp.ui.panel.toolbar.search.dropdown.render('rerender');
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
                        localpaths: {},
                        connections_data: {},
                        connections: {}
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
                        
                        var i = eqftp.utils.uniq();
                        //var i = $('#eqftp-connections-list .eqftp-accordion-group').length - 1;
                        clone.find('*[name]').each(function () {
                            var name = $(this).attr('name');
                            name = 'eqftpSettings' + name.replace(/\{\$i\}/gmi, i);
                            $(this).attr('name', name);
                        });
                    }
                },
                callbacks: {}
            },
            _e: function (text, errtype, error) {
                // prints error in log
                if (eqftp.utils.check.isString(text)) {
                    var match = text.match(/^$(.*)/);
                    if (match) {
                        text = strings[match[1]];
                    }
                }
                
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
                        } else if (eqftp.utils.check.isArray(text) || (eqftp.utils.check.isObject(text) && !text.text)) {
                            params.body += JSON.stringify(text);
                        } else if (eqftp.utils.check.isObject(text) && text.text) {
                            params.body += text.text;
                        }
                        break;
                    case 'connections':
                        if (error.code) {
                            params.title += 'Connection issues: ' + error.code;
                            if (eqftp.utils.check.isString(text)) {
                                params.body += text;
                            } else if (eqftp.utils.check.isArray(text) || (eqftp.utils.check.isObject(text) && !text.text)) {
                                params.body += JSON.stringify(text);
                            } else if (eqftp.utils.check.isObject(text) && text.text) {
                                params.body += text.text;
                                if (text.params) {
                                    _.unset(text.params, ['password', 'rsa', 'localpath', 'remotepath']);
                                    params.body += "\n\nConnection's parameters:\n" + JSON.stringify(text.params) + "\n\nParameters password, rsa, localpath and remotepath are omitted";
                                }
                            }
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
                if (!eqftp.utils.check.isString(text)) {
                    if (text.text) {
                        text = text.text;
                    } else {
                        text = JSON.stringify(text);
                    }
                }
                if (error && error.code) {
                    text += '. ' + strings['eqftp__connection__errors__' + error.code];
                }
                console.error(text);
                eqftp.utils.log('[ERROR] ' + text, 'error');
            },
            _w: function (text) {
                // prints error in log
                console.warn(text);
            }
        };
    eqftp = _.assignIn(eqftp, EventEmitter);
    eqftp.on('event', function (event) {
        if (!event) {
            return false;
        }
        console.log(event);
        if (event.action) {
            switch (event.action) {
            case 'queue:update':
                eqftp.connections._run_queue(event.connection_id);
                break;
            }
        }
    });
    
    AppInit.htmlReady(function () {
        ExtensionUtils.loadStyleSheet(module, "styles/ext.css");
        $("#main-toolbar .buttons").append(tpl__toolbar);
        
        $('body').on('click', '[eqftp-click]', function (e) {
            var params = $(this).attr('eqftp-click');
            e.preventDefault();
            eqftp.utils.action(params, e);
        });
        $('body').on('dblclick', '[eqftp-dblclick]', function (e) {
            var params = $(this).attr('eqftp-dblclick');
            e.preventDefault();
            eqftp.utils.action(params, e);
        });
        $('body').on('mousewheel', '[eqftp-mousewheel]', function (e) {
            var params = $(this).attr('eqftp-mousewheel');
            eqftp.utils.action(params, e);
        });
        $('body').on('scroll', '[eqftp-scroll]', function (e) {
            var params = $(this).attr('eqftp-scroll');
            eqftp.utils.action(params, e);
        });
        $('body').on('change', '[eqftp-change]', function (e) {
            var params = $(this).attr('eqftp-change');
            e.preventDefault();
            eqftp.utils.action(params, e);
        });
        $('body').on('mouseenter', '[eqftp-mouseenter]', function (e) {
            var params = $(this).attr('eqftp-mouseenter');
            e.preventDefault();
            eqftp.utils.action(params, e);
        });
        $('body').on('mouseleave', '[eqftp-mouseleave]', function (e) {
            var params = $(this).attr('eqftp-mouseleave');
            e.preventDefault();
            eqftp.utils.action(params, e);
        });
        $('body').on('keyup', '[eqftp-keyup]', function (e) {
            var params = $(this).attr('eqftp-keyup');
            eqftp.utils.action(params, e);
        });
        $('body').on('input', '[eqftp-input]', function (e) {
            var params = $(this).attr('eqftp-input');
            eqftp.utils.action(params, e);
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

        _node = new NodeConnection();
        function connectNode() {
            var connectionPromise = _node.connect(true);
            connectionPromise.fail(function (err) {
                eqftp._e(err);
            });
            return connectionPromise;
        }
        function loadNodeFtp() {
            var path = ExtensionUtils.getModulePath(module, "node/ftpDomain");
            var loadPromise = _node.loadDomains([path], true);
            loadPromise.fail(function (err) {
                eqftp._e(err);
            });
            loadPromise.done(function (done) {
                _node.on("eqFTP:event", function (event, params) {
                    if (!params.action) {
                        params.action = 'info';
                    }
                    switch (params.action) {
                    case 'error':
                        eqftp._e(params.text, params.errType, params.error);
                        break;
                    case 'info':
                    case 'success':
                        eqftp.utils.log(params.text, params.action);
                        break;
                    case 'do':
                        eqftp.utils.do(params.path, params.params, null, params.returnIt);
                        break;
                    case 'debug':
                        if (_eqFTPSettings.main.debug) {
                            console.warn(params.info);
                            console.warn(params.info_string);
                        }
                        break;
                    case 'callback':
                        if (eqftp.utils.check.isFunction(eqftp.variables.callbacks[params._id])) {
                            eqftp.variables.callbacks[params._id](params.callback);
                            _.unset(eqftp.variables.callbacks, params._id);
                        }
                        break;
                    case 'connection':
                        if (!params.id) {
                            return false;
                        }
                        var connection = eqftp.connections._getByID(params.id);
                        switch (params.status) {
                        case 'close':
                            eqftp.utils.log(strings.eqftp__connection__event__closed + connection.name);
                            break;
                        case 'open':
                            eqftp.utils.log(strings.eqftp__connection__event__opened + connection.name);
                            break;
                        case 'error':
                            eqftp._e({text: strings.eqftp__connection__event__error + connection.name, params: connection}, params.errType || {}, params.error || {});
                            break;
                        }
                        break;
                    }
                });
            });
            return loadPromise;
        }
        eqftp.utils.chain(connectNode, loadNodeFtp);
        
        eqftp._init();
    });
});