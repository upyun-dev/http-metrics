'use strict';

const http = require('http');
const https = require('https');
const url = require('url');
const util = require('./util');

function request(options, callback) {
  if (typeof options === 'string') {
    options = url.parse(options);
    if (!options.hostname) {
      return callback(new Error('Unable to determine the domain name'));
    }
  }

  let callbacked = false;

  if (options.protocol === 'https:') {
    options._defaultAgent = https.globalAgent;
  }

  let result = {
    time_namelookup: 0,
    time_starttransfer: 0,
    time_total: 0,
    time_appconnect: 0,
    time_connect: 0,
    size_download: 0,
    status_code: 0
  };

  let req = http.request(options);
  let startTime;

  // end timeout ID
  let etid;

  req.clearEndTimeout = function() {
    clearTimeout(etid);
  };

  req.setEndTimeout = function(newEndTimeout) {
    if (!newEndTimeout) return;
    let endTimeout = +newEndTimeout * 1000;
    req.clearEndTimeout();
    etid = setTimeout(function() {
      req.emit('timeout');
    }, endTimeout);
  };

  let done = function(err, result) {
    req.destroy();
    if (callbacked) return;
    req.clearEndTimeout();
    callbacked = true;
    return callback(err, result);
  };
  req.setEndTimeout(options.timeout);
  req.setTimeout(+(options.connect_timeout || 0) * 1000, function() {
    let error = new Error('request timeout');
    error.code = 'ETIMEDOUT';
    done(error, result);
  });
  startTime = new Date();
  req.on('response', function(res) {
    result.status_code = res.statusCode;
    let length = 0;

    res.on('data', function(chunk) {
      if (!result.time_starttransfer) result.time_starttransfer = util.timeToNow(startTime);
      length += chunk.length;
    });

    res.on('end', function() {
      result.time_total = util.timeToNow(startTime);
      result.size_download = length;
      return done(null, result);
    });
  });

  req.on('error', function(err) {
    done(err, result);
  });

  req.on('socket', function(s) {
    s.on('secureConnect', function() {
      result.time_appconnect = util.timeToNow(startTime);
    });
    s.on('lookup', function() {
      result.time_namelookup = util.timeToNow(startTime);
    });
    s.on('connect', function() {
      req.clearEndTimeout();
      result.time_connect = util.timeToNow(startTime);
    });
  });

  req.end();
}

module.exports = request;
