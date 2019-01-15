const {remote} = require('electron')
const fs = require('fs')
const setting = remote.require('./setting')
const dialog = require('./dialog')
const winston = require('winston')
const path = require('path')
const helper = require('../modules/helper')

let filename = null

let winstonLogger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss.SSS'}),
        winston.format.printf(info => {
            return `\[${info.timestamp}\] ${info.message}`
        })),
    handleExceptions: false,
    exitOnError: false})

exports.write = function(stream) {
    let gtpText = ""

    let enabled = setting.get('gtp.console_log_enabled')
    if (enabled == null || !enabled) { return }

    let typeText = ""
    if (stream.type === 'stderr') {
        gtpText += stream.message
        typeText = "  (err)"
    } else if (stream.type === 'stdin') {
        gtpText += stream.message
        typeText = "   (in)"
    } else if (stream.type === 'stdout') {
        gtpText += stream.message
        typeText = "  (out)"
    } else if (stream.type === 'meta') {
        gtpText += stream.message
        typeText = " (meta)"
    }

    let color
    if (stream.sign === 1) {
        color = "B"
    } else if (stream.sign === -1) {
        color = "W"
    } else {
        color = ""
    }

    let engine
    if (stream.engine != null) {
        engine = " <" + stream.engine + ">"
    } else {
        engine = "<>"
    }

    gtpText = color + engine + typeText + " : " + gtpText

    winstonLogger.log('info', gtpText)
}

let timestamp = function() {
    let now = new Date()
    let t = {
        'month': 1 + now.getMonth(),
        'day': now.getDate(),
        'hour': now.getHours(),
        'minute': now.getMinutes(),
        'second': now.getSeconds()
    }
    for(let idx in t) {
        if (t[idx] < 10) {
            t[idx] = "0" + t[idx]
        }
    }
    t['year'] = now.getFullYear()
    return t['year'] + "-" + t['month'] + "-" + t['day'] + "-" +
        t['hour'] + "-" + t['minute'] + "-" + t['second']
}

exports.updatePath = function() {
    let newDir = null
    let enabled = null
    // remove trailing separators and normalize
    let logPath = setting.get('gtp.console_log_path')
    if (logPath != null && typeof logPath === 'string') {
        newDir = path.resolve(setting.get('gtp.console_log_path'))
    }
    enabled = setting.get('gtp.console_log_enabled')

    let newName = null
    if (filename == null) {
        // generate a new log file name
        newName = "sabaki" + "_" +
            timestamp() + "_" +
            (sabaki.window.webContents.getOSProcessId().toString()) +
            ".log"
    } else {
        newName = filename
    }

    try {
        if ((enabled != null) && (newDir != null) && enabled) {
            let newPath = path.join(newDir, newName)
            let matching = winstonLogger.transports.find(transport => {
                return (transport.filename === newName) &&
                    (path.resolve(transport.dirname) === newDir)
            })
            if (matching != null) {
                return
            }
            filename = newName
            let notmatching = winstonLogger.transports.find(transport => {
                return (transport.filename !== newName) ||
                    (path.resolve(transport.dirname) !== newDir)
            })
            winstonLogger.add(new winston.transports.File({ filename: newPath }))
            if (notmatching != null) {
                winstonLogger.remove(notmatching)
            }
        }
    } catch (err) {}
}

exports.validate = function() {
    if (!helper.isWritableDirectory(setting.get('gtp.console_log_path'))) {
        let enabled = setting.get('gtp.console_log_enabled')
        if (enabled != null && enabled) {
            dialog.showMessageBox([
                'You have an invalid log folder for GTP console logging in your settings.\n\n',
                'Please make sure the log directory is valid & writable or disable GTP console logging.',
                ].join(''), 'warning'
            )
        }
        return false
    } else {
        return true
    }
}

exports.loadOnce = function() {
    if (exports.validate()) {
        exports.updatePath()
    }
}

exports.rotate = function() {
    // On next engine attach, we will use a new log file
    filename = null
}

exports.close = function() {
    try {
        winstonLogger.close()
    } catch (err) {}
}
