var redis = require('redis'),
  rdb,
  config = require('./config');

if (process.env.NODE_ENV === 'production') {
  rdb = redis.createClient(config.redis.port, config.redis.host);
  rdb.auth(config.redis.password);
} else {
  rdb = redis.createClient();
}
exports.rdb = rdb;

if (process.env.NODE_ENV === 'production') {
  rdb1 = redis.createClient(config.redis.port, config.redis.host);
  rdb1.auth(config.redis.password);
} else {
  rdb1 = redis.createClient();
}

exports.rdb1 = rdb1;

var express = require('express'),
  RedisStore = require('connect-redis')(express),
  sessionStore = new RedisStore({ client: rdb });

exports.sessionStore = sessionStore;

