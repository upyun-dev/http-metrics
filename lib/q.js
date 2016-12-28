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

  let callbacked = false;
  let timeoutError = null;
  let startTime = new Date();
  // end timeout ID
  let etid;
  let req = http.request(options);

  let done = function(err, result) {
    if (callbacked) return;
    req.clearEndTimeout();
    result.time_total = util.timeToNow(startTime);
    callbacked = true;
    callback(timeoutError || err || null, result);
  };

  req.clearEndTimeout = function() {
    clearTimeout(etid);
  };

  req.setEndTimeout = function(newEndTimeout) {
    if (!newEndTimeout) return;
    let endTimeout = (+newEndTimeout || 9999) * 1000;
    req.clearEndTimeout();
    etid = setTimeout(function() {
      req.emit('timeout');
    }, endTimeout);
  };
  req.setEndTimeout(options.timeout);

  req.setTimeout(+(options.connect_timeout || 0) * 1000, function() {
    let error = new Error('request timeout');
    error.code = 'ETIMEDOUT';
    timeoutError = error;
    req.abort();
  });

  req.on('response', function(res) {
    result.status_code = res.statusCode;
    let length = 0;

    res.on('data', function(chunk) {
      if (!result.time_starttransfer) result.time_starttransfer = util.timeToNow(startTime);
      length += chunk.length;
      result.size_download = length;
    });

    res.on('end', function() {
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
      result.time_connect = util.timeToNow(startTime);
    });
  });

  req.end();
}

module.exports = request;
