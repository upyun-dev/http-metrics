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

  let startTime = new Date();
  let req = http.request(options);

  let result = {
    time_namelookup: 0,
    time_starttransfer: 0,
    time_total: 0,
    time_appconnect: 0,
    time_connect: 0,
    size_download: 0,
    status_code: 0
  };

  // connect timeout ID
  let ctid;

  req.clearConnectTimeout = function() {
    clearTimeout(ctid);
  };

  req.setConnectTimeout = function(newConnectTimeout) {
    let connectTimeout = +(newConnectTimeout || 9999) * 1000;
    req.clearConnectTimeout();
    ctid = setTimeout(function() {
      req.destroy();
    }, connectTimeout);
  };

  // timeout ID
  let tid;

  req.clearTimeout = function() {
    clearTimeout(tid);
  };

  req.setTimeout = function(newTimeout) {
    let timeout = +(newTimeout || 9999) * 1000;
    req.clearTimeout();
    tid = setTimeout(function() {
      req.destroy();
    }, timeout);
  };

  req.setConnectTimeout(options.connect_timeout);
  req.setTimeout(options.timeout);

  req.on('response', function(res) {
    req.clearConnectTimeout();
    result.status_code = res.statusCode;
    let length = 0;

    res.on('data', function(chunk) {
      length += chunk.length;
    });

    res.on('end', function() {
      result.time_total = util.timeToNow(startTime);
      result.size_download = length;
      req.clearTimeout();
      return callback(null, result);
    });
  });

  req.on('error', function(err) {
    req.clearConnectTimeout();
    req.clearTimeout();
    if (err.code === 'ECONNRESET') {
      let error = new Error('request timeout');
      error.code = 'ETIMEOUT';
      return callback(error, result);
    }
    return callback(err, result);
  });

  req.on('socket', function(s) {
    s.on('data', function(data) {
      if (!result.time_starttransfer) result.time_starttransfer = util.timeToNow(startTime);
    });
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
