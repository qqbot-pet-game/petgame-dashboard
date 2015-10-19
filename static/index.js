DEFAULT_PORT = 8080;

current_host = null;
current_bot_id = null;
is_loading_bots = false;
bot_load_interval = 1000;

$.fn.disable = function() {
    $(this).attr('disabled', 'disabled');
}
$.fn.enable = function() {
    $(this).removeAttr('disabled');
}

Array.prototype.has = function(val) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] == val) return true;
    }
    return false;
}

$(document).ready(function (e) {
    var $window = $(window);
    var $host_list = $('#host-list');
    $window.scroll(function(event) {
        $('#right-panel-status').css('margin-top', Math.max($window.scrollTop() - $host_list.offset().top, 0) + 'px');
    });
    $('#host-list').on('click', '.list-group-item', function(event) {
        $(this).siblings().removeClass('active');
        $(this).addClass('active');
        loadHost($(this).data('host'));
    });

    $('.btn-set-localhost').click(function(event) {
        $(this).closest('.input-group-btn').siblings('input').val('localhost');
    });

    $('#btn-add-host').click(function(event) {
        addHostPre();
    });
    $('#btn-add-host-submit').click(function(event) {
        addHost();
    });

    $('#btn-delete-host').click(function(event) {
        showMessage("确定要删除这个站点吗？", {ack: function() {
            deleteHost(current_host);
        }});
    });
    $('#btn-edit-host').click(function(event) {
        editHost();
    });
    $('#btn-reload-host').click(function(event) {
        loadHost(current_host);
    });

    $('#btn-add-bot').click(function(event) {
        addBotPre();
    });

    $('#btn-bot-admin-qq-add').click(function(event) {
        adminQQInput().appendTo('#bot-admin-qq-input-list');
    });
    $('#dialog-config-bot')
    .on('click', '.btn-bot-admin-qq-remove', function(event) {
        $(this).closest('.bot-admin-qq-input-container').remove();
    })
    .on('change', '.group-switch input', function(event) {
        var container_el = $(this).closest('.bot-group-checkbox-container');
        var gitem = container_el.data('gitem');
        gitem.in_admin = $(this).is(':checked');
    });

    $('#bot-list')
    .on('click', '.btn-login', function(event) {
        var bot = $(this).closest('.bot-item').data('bot');
        addBotLogin(bot);
    })
    .on('click', '.btn-config', function(event) {
        current_bot_id = $(this).closest('.bot-item').data('bot')._id;
        configBotPre();
    })
    .on('click', '.btn-stop', function(event) {
        current_bot_id = $(this).closest('.bot-item').data('bot')._id;
        shutdownBot();
    });

    $('#btn-config-bot-save').click(function(event) {
        configBot();
    });

    $('#dialog-add-bot').on('hidden.bs.modal', function () {
        loadHost(current_host);
    });

    loadHosts();
    setInterval(function() {
        loadHost(current_host, true);
    }, bot_load_interval);
});

function hostNavEl(host) {
    var return_el = null;
    $('#host-list .list-group-item').each(function(index, el) {
        if ($(el).data('host') == host) {
            return_el = $(el);
            return false;
        }
    });
    return return_el;
}
function loadHost(host, isReload) {
    if (!host) {
        $('#right-panel-spinner-box').hide();
        $('#right-panel-notload-box').hide();
        $('#site-info-container').hide();
        $('#site-bots-container').hide();
        return;
    }
    if (isReload && is_loading_bots) {
        return;
    }
    is_loading_bots = true;
    current_host = host;
    if (!isReload) {
        $('#host-edit-name').val(host.name);
        $('#host-edit-addr').val(host.addr);
        $('#host-edit-port').val(host.port);
        $('#site-info-container').show();
    }
    if (!isReload) $('#right-panel-spinner-box').show();
    if (!isReload) $('#right-panel-notload-box').hide();
    if (!isReload) $('#site-bots-container').hide();
    $.ajax({
        url: '/request/' + host.addr + ':' + host.port + '/status',
        type: 'GET',
        dataType: 'json'
    })
    .done(function(data) {
        if (data && (data instanceof Array)) {
            var els_to_remove = $('#bot-list').children();
            for (var i = 0; i < data.length; i++) {
                var item = data[i];
                botItem(item).appendTo('#bot-list');
            }
            els_to_remove.remove();

            $('#right-panel-spinner-box').hide();
            $('#right-panel-notload-box').hide();
            $('#site-bots-container').show();
        } else {
            loadHostFailed();
        }
    })
    .fail(function() {
        loadHostFailed();
    })
    .always(function() {
        is_loading_bots = false;
    });
}
function loadHostFailed() {
    $('#right-panel-spinner-box').hide();
    $('#right-panel-notload-box').show();
    $('#site-bots-container').hide();
}

function loadHosts() {
    $('#host-list-spinner-container').show();
    $('#host-list-container').hide();
    $.ajax({
        url: '/api/host',
        type: 'GET',
        dataType: 'json'
    })
    .done(function(data) {
        if (!data) {
            showMessage("无法加载站点信息，请联系系统管理员。")
            return;
        }
        var hosts = data;
        $('#host-list').children('.list-group-item').remove();
        for (i = 0; i < hosts.length; i++) {
            hostItem(hosts[i]).appendTo('#host-list');
        }
        $('#host-list-container').show();
    })
    .fail(function() {
        showMessage("无法加载站点信息，请联系系统管理员。")
    })
    .always(function() {
        $('#host-list-spinner-container').hide();
    });
}

function hostItem(host) {
    var el = $('<a href="javascript:;" class="list-group-item">' +
                    '<h2 class="host-item-name">' + host.name + '</h2>' +
                    '<h4 class="host-item-addrport">http://' + 
                    '<span class="host-item-addr">' + host.addr + '</span>:' + 
                    '<span class="host-item-port">' + host.port + '</span>' + '/</h4>' +
                '</a>');
    el.data('host', host);
    return el;
}
function botItem(bot) {
    var bot_status, bot_status_class;
    if (bot.status == "offline") {
        bot_status = "已停止";
        bot_status_class = 'danger';
    } else if (bot.status == "online") {
        bot_status = "正在运行";
        bot_status_class = 'success';
    } else if (bot.status == "login") {
        bot_status = "正在登录...";
        bot_status_class = 'login';
    } else {
        return null;
    }
    var el = $('<li class="list-group-item bot-item">' +
                    '<div class="row">' +
                        '<div class="col-xs-6"><span class="bot-account">' + bot.account + '</span></div>' +
                        '<div class="col-xs-3"><span class="bot-status text-' + bot_status_class + '">' + bot_status + '</span></div>' +
                        '<div class="col-xs-3">' +
                            '<div class="btn-group" role="group" aria-label="...">' +
                                ((bot.status == "login") ? ('<button type="button"' + (bot.status == "offline" ? ' disabled = "disabled"' : '') + ' class="btn btn-default btn-login">登录</button>') : '') +
                                ((bot.status == "online") ? ('<button type="button"' + (bot.status == "offline" ? ' disabled = "disabled"' : '') + ' class="btn btn-default btn-config">配置</button>') : '') +
                                '<button type="button"' + (bot.status == "offline" ? ' disabled = "disabled"' : '') + ' class="btn btn-danger btn-stop">停止</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</li>');
    el.data('bot', bot);
    return el;
}
function adminQQInput(account) {
    if (!account) account = '';
    return $('<div class="col-xs-6 bot-admin-qq-input-container">' +
            '<div class="form-group input-group">' +
                '<input type="text" class="form-control" placeholder="QQ号" value="' + account + '" />' +
                '<span class="input-group-btn"><button class="btn btn-default btn-bot-admin-qq-remove" type="button">删除</button></span>' +
            '</div>' +
        '</div>');
}

function showMessage(message, options) {
    options = $.extend(true, {
        'type': null,
        'ack': null,
        'cancel': null
    }, options);
    var $text_area = $('#dialog-info-text');
    $text_area.text(message);
    if (options.type) $text_area.attr('class', type ? 'text-'+type : '');
    $('#dialog-info-cancel').off('click.showMessage');
    $('#dialog-info-ack').off('click.showMessage');
    if (typeof options.cancel == 'function') $('#dialog-info-cancel').on('click.showMessage', options.cancel);
    if (typeof options.ack == 'function') $('#dialog-info-ack').on('click.showMessage', options.ack);
    $('#dialog-information').modal('show');
}
function loadingDialog(doshow, callback) {
    $('#dialog-loading').off('shown.bs.modal');
    $('#dialog-loading').off('hidden.bs.modal');
    if (typeof callback == "function") $('#dialog-loading').one('shown.bs.modal', function() { callback(); $('#dialog-loading').off('hidden.bs.modal');} );
    if (typeof callback == "function") $('#dialog-loading').one('hidden.bs.modal', function() { callback(); $('#dialog-loading').off('shown.bs.modal');} );
    if (doshow === undefined || doshow === null) $('#dialog-loading').modal('toggle');
    else if (doshow) $('#dialog-loading').modal('show');
    else $('#dialog-loading').modal('hide');
}

function addHostPre() {
    $('#dialog-add-host-alert').hide();
    $('#host-add-name').val('');
    $('#host-add-addr').val('');
    $('#host-add-port').val('');
    $('#dialog-add-host').modal('show');
}
function addHost() {
    var dataObj = {
        "name": $('#host-add-name').val(),
        "addr": $('#host-add-addr').val(),
        "port": parseInt($('#host-add-port').val() ? $('#host-add-port').val() : DEFAULT_PORT)
    };
    if (!dataObj.name || !dataObj.addr || isNaN(dataObj.port) || (dataObj.port < 0 || dataObj.port > 65535)) {
        $('#dialog-add-host-alert').text("输入参数不合法").show();
        return;
    }
    $('#btn-add-host-submit').disable();
    $('#btn-add-host-cancel').disable();
    $('#add-host-loading-spinner').show();
    $.ajax({
        url: '/api/host',
        type: 'POST',
        dataType: 'json',
        data: JSON.stringify(dataObj)
    })
    .done(function(data) {
        if (data.status != 0) {
            var warning_txt = "添加失败，请重试。";
            if (data.status == 1) warning_txt = "该站点已经存在。";
            $('#dialog-add-host-alert').text(warning_txt).show();
            return;
        }
        dataObj.id = data.data.id;
        hostItem(dataObj).appendTo('#host-list');
        $('#dialog-add-host').modal('hide');
    })
    .fail(function() {
        $('#dialog-add-host-alert').text("添加失败，请重试。").show();
    })
    .always(function() {
        $('#btn-add-host-submit').enable();
        $('#btn-add-host-cancel').enable();
        $('#add-host-loading-spinner').hide();
    });
}

function editHost() {
    var dataObj = $.extend(true, {}, current_host, {
        "name": $('#host-edit-name').val(),
        "addr": $('#host-edit-addr').val(),
        "port": parseInt($('#host-edit-port').val() ? $('#host-edit-port').val() : DEFAULT_PORT)
    });
    var result_msg = "";
    if (!dataObj.name || !dataObj.addr || isNaN(dataObj.port) || (dataObj.port < 0 || dataObj.port > 65535)) {
        showMessage("无法保存，输入的参数不合法。");
        return;
    }
    $('#btn-delete-host').disable();
    $('#btn-edit-host').disable();
    loadingDialog(true);
    $.ajax({
        url: '/api/host?host=' + current_host.id,
        type: 'POST',
        dataType: 'json',
        data: JSON.stringify(dataObj)
    })
    .done(function(data) {
        if (data.status != 0) {
            result_msg = "保存失败，请重试。";
            if (data.status == 1) result_msg = "该站点已经存在。";
            return;
        }
        result_msg = "保存成功。"
        current_host.name = dataObj.name;
        current_host.addr = dataObj.addr;
        current_host.port = dataObj.port;
        host_el = hostNavEl(current_host);
        host_el.find('.host-item-name').text(current_host.name);
        host_el.find('.host-item-addr').text(current_host.addr);
        host_el.find('.host-item-port').text('' + current_host.port);
        loadHost(current_host);
    })
    .fail(function() {
        result_msg = "保存失败，请重试。";
    })
    .always(function() {
        $('#btn-delete-host').enable();
        $('#btn-edit-host').enable();
        loadingDialog(false, function() { showMessage(result_msg); });
    });
}

function deleteHost(host) {
    $('#btn-delete-host').disable();
    $('#btn-edit-host').disable();
    loadingDialog(true);
    var result_msg = "";
    $.ajax({
        url: '/api/host/delete?host=' + host.id,
        type: 'GET',
        dataType: 'json'
    })
    .done(function(data) {
        if (data.status != 0) {
            result_msg = "删除失败！";
            return;
        }
        hostNavEl(host).remove();
        loadHost();
        result_msg = "已成功删除。";
    })
    .fail(function() {
        result_msg = "删除失败！";
    })
    .always(function() {
        $('#btn-delete-host').enable();
        $('#btn-edit-host').enable();
        loadingDialog(false, function() { showMessage(result_msg); });
    });
}

function addBotPre() {
    $('#add-bot-spinner').show();
    $('#add-bot-qrcode').hide();
    var result_msg = "";
    var preFunc = function() {
        $.ajax({
            url: '/request/' + current_host.addr + ':' + current_host.port + '/launch',
            type: 'GET',
            dataType: 'json'
        })
        .done(function(data) {
            console.log('done');
            console.log($('#dialog-add-bot').is(':hidden'));
            if ($('#dialog-add-bot').is(':hidden')) return;
            console.log('done1');
            addBotLogin(data);
        })
        .fail(function() {
            console.log('fail');
            if ($('#dialog-add-bot').is(':hidden')) return;
            result_msg = "启动QQ机器人失败，请重试或联系管理员。";
            $('#dialog-add-bot').one('hidden.bs.modal', function(event) {
                showMessage(result_msg);
            });
            $('#dialog-add-bot').modal('hide');
        })
        .always(function() {
            console.log('always');
            if ($('#dialog-add-bot').is(':hidden')) return;
        });
    }
    if ($('#dialog-add-bot').is(':hidden')) {
        $('#dialog-add-bot').one('shown.bs.modal', preFunc);
    } else {
        preFunc();
    }
}
function addBotLogin(bot) {
    var result_msg = "";
    var data_gnamelist, data_config;
    $('#add-bot-spinner').show();
    $('#add-bot-qrcode').hide();
    var loginFunc = function() {
        $('#add-bot-qrcode img').one('load', function(event) {
            $('#add-bot-spinner').hide();
            $('#add-bot-qrcode').show();
            $(this).data('error_time', 0);
            $(this).off('error.qrcode');
            $.when($.ajax({
                url: '/request/' + current_host.addr + ':' + current_host.port + '/gnamelist|id=' + bot._id,
                type: 'GET',
                dataType: 'json'
            }).done(function(dataa) {
                data_gnamelist = dataa;
            }), $.ajax({
                url: '/request/' + current_host.addr + ':' + current_host.port + '/config|id=' + bot._id,
                type: 'GET',
                dataType: 'json'
            }).done(function(dataa) {
                data_config = dataa;
            }))
            .done(function() {
                if ($('#dialog-add-bot').is(':hidden')) return;
                if (data_gnamelist.status != 0 || data_config.status != 0) {
                    result_msg = "启动QQ机器人失败，请重试或联系管理员。";
                    $('#dialog-add-bot').one('hidden.bs.modal', function(event) {
                        showMessage(result_msg);
                    });
                } else {
                    $('#dialog-add-bot').one('hidden.bs.modal', function(event) {
                        var admin_list = data_config.data.admins;
                        var gcode_list = (function() {
                            for (var i = 0; i < data_gnamelist.data.length; i++) {
                                data_gnamelist.data[i].in_admin = data_config.data.gcodes.has(data_gnamelist.data[i].code);
                            }
                            return data_gnamelist.data;
                        })();
                        current_bot_id = bot._id;
                        configBotLoad(admin_list, gcode_list);
                        $('#dialog-config-bot').modal('show');
                    });
                }
            })
            .fail(function() {
                if ($('#dialog-add-bot').is(':hidden')) return;
                result_msg = "启动QQ机器人（等待扫码）超时，请重试。";
                $('#dialog-add-bot').one('hidden.bs.modal', function(event) {
                    showMessage(result_msg);
                });
            })
            .always(function() {
                if ($('#dialog-add-bot').is(':hidden')) return;
                $('#dialog-add-bot').modal('hide');
            });
        });
        $('#add-bot-qrcode img').on('error.qrcode', function(event) {
            $this = $(this);
            var error_time = ($this.data('error_time') || 0) + 1;
            var src = $this.attr('src');
            if (error_time > 20 || !src) {
                if ($('#dialog-add-bot').is(':hidden')) return;
                $this.data('error_time', 0);
                $this.off('error.qrcode');
                $('#dialog-add-bot').one('hidden.bs.modal', function(event) {
                    showMessage("启动QQ机器人（加载二维码）超时，请重试。");
                });
                $('#dialog-add-bot').modal('hide');
                return;
            }
            $this.data('error_time', error_time);
            setTimeout(function() {
                $this.attr('src', src.split('?')[0] + "?t=" + (new Date().getTime()));
            }, 500);
        });
        $('#add-bot-qrcode img').attr('src', 'http://' + current_host.addr + ':' + current_host.port + bot.qrcode_url);
    }
    if ($('#dialog-add-bot').is(':hidden')) {
        $('#dialog-add-bot').one('shown.bs.modal', loginFunc);
        $('#dialog-add-bot').modal('show');
    } else {
        loginFunc();
    }
}

function configBotPre() {
    loadingDialog(true);
    var result_msg = null;
    $('#btn-config-bot-save').disable();
    $('#config-bot-spinner').show();
    $('#config-bot-main-panel').hide();
    $('#config-bot-warning-box').hide();
    var data_gnamelist, data_config;
    $.when($.ajax({
        url: '/request/' + current_host.addr + ':' + current_host.port + '/gnamelist|id=' + current_bot_id,
        type: 'GET',
        dataType: 'json'
    }).done(function(dataa) {
        data_gnamelist = dataa;
    }), $.ajax({
        url: '/request/' + current_host.addr + ':' + current_host.port + '/config|id=' + current_bot_id,
        type: 'GET',
        dataType: 'json'
    }).done(function(dataa) {
        data_config = dataa;
    }))
    .done(function() {
        if (data_gnamelist.status != 0 || data_config.status != 0) {
            result_msg = "加载QQ机器人失败，请重试或联系管理员。";
            loadingDialog(false, function(event) {
                if (result_msg) showMessage(result_msg);
            });
        } else {
            loadingDialog(false, function(event) {
                var admin_list = data_config.data.admins;
                var gcode_list = (function() {
                    for (var i = 0; i < data_gnamelist.data.length; i++) {
                        data_gnamelist.data[i].in_admin = data_config.data.gcodes.has(data_gnamelist.data[i].code);
                    }
                    return data_gnamelist.data;
                })();
                configBotLoad(admin_list, gcode_list);
                $('#dialog-config-bot').modal('show');
            });
        }
    })
    .fail(function() {
        result_msg = "加载QQ机器人超时，请重试。";
        loadingDialog(false, function(event) {
            if (result_msg) showMessage(result_msg);
        });
    })
    .always(function() {
    });
}
function configBotLoad(admin_list, gcode_list) {
    $('#btn-config-bot-save').disable();
    $('#bot-admin-qq-input-list').children().remove();
    $('#config-bot-group-list').children().remove();
    for (var i = 0; i < admin_list.length; i++) {
        adminQQInput(admin_list[i]).appendTo('#bot-admin-qq-input-list');
    }
    for (var i = 0; i < gcode_list.length; i++) {
        var gcode_item = gcode_list[i];
        $('<div class="col-xs-6 bot-group-checkbox-container">' +
                '<div class="form-horizontal">' +
                    '<div class="control-group">' +
                        '<div class="switch switch-mini group-switch" tabindex="0">' +
                            '<input id="bot-group-checkbox-' + gcode_item.code + '" type="checkbox" ' + (gcode_item.in_admin ? 'checked' : '') + ' />' +
                        '</div>' +
                        '<label class="control-label" for="bot-group-checkbox-' + gcode_item.code + '">' + gcode_item.name + '</label>' +
                    '</div>' +
                '</div>' +
            '</div>').data('gitem', gcode_item).appendTo('#config-bot-group-list').find('.switch').bootstrapSwitch();
    };
    $('#config-bot-spinner').hide();
    $('#config-bot-main-panel').show();
    $('#config-bot-warning-box').hide();
    $('#btn-config-bot-save').enable();
}
function configBot() {
    var admin_list = [],
        gcode_list = [],
        err_msg = null;
    $('#bot-admin-qq-input-list .bot-admin-qq-input-container').each(function(index, el) {
        var val = $(el).find('input').val();
        if (!val || val == "") return true;
        val = parseInt(val);
        if (isNaN(val)) {
            err_msg = "填入的QQ号不正确！";
            return false;
        }
        admin_list.push(''+val);
    });
    if (err_msg) {
        $('#config-bot-warning-text').text(err_msg);
        $('#config-bot-warning-box').show();
        return;
    }
    $('#config-bot-group-list .bot-group-checkbox-container').each(function(index, el) {
        gitem = $(el).data('gitem');
        if (gitem.in_admin) gcode_list.push(gitem.code);
    });
    if (err_msg) {
        $('#config-bot-warning-text').text(err_msg);
        $('#config-bot-warning-box').show();
        return;
    }
    $('#btn-config-bot-save').disable();
    $('#config-bot-spinner').show();
    $('#config-bot-main-panel').hide();
    $('#config-bot-warning-box').hide();
    $.ajax({
        url: '/request/' + current_host.addr + ':' + current_host.port + '/config|id=' + current_bot_id,
        type: 'POST',
        dataType: 'json',
        data: JSON.stringify({admins: admin_list, gcodes: gcode_list}),
    })
    .done(function(data) {
        if (data.status != 0) {
            $('#config-bot-main-panel').show();
            $('#config-bot-warning-text').text("保存配置失败，请重试。");
            $('#config-bot-warning-box').show();
        }
        $('#dialog-config-bot').modal('hide');
    })
    .fail(function() {
        $('#config-bot-main-panel').show();
        $('#config-bot-warning-text').text("保存配置失败，请重试。");
        $('#config-bot-warning-box').show();
    })
    .always(function() {
        $('#config-bot-spinner').hide();
        $('#btn-config-bot-save').enable();
        loadHost(current_host);
    });
}
function shutdownBot() {
    loadingDialog(true);
    var result_msg = "";
    $.ajax({
        url: '/request/' + current_host.addr + ':' + current_host.port + '/shutdown|id=' + current_bot_id,
        type: 'GET',
        dataType: 'json'
    })
    .done(function(data) {
        if (data.status != 0) {
            result_msg = "关闭失败！";
        } else {
            result_msg = "已成功关闭";
        }
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
        result_msg = "关闭失败！";
    })
    .always(function() {
        loadingDialog(false, function() {
            showMessage(result_msg);
        });
        loadHost(current_host);
    });
}




