#!/usr/bin/env node

var http = require('http');
  config = require('../config'),
  redis = require('redis'),
  rdb = require('../db').rdb1,
  _ = require('underscore');

var getLiveStream = function(channels, callback) {
  var result = '';
  var options = {
    host: 'api.justin.tv',
    port: 80,
    path: '/api/stream/list.json?channel='+channels.join(','),
    method: 'GET'
  };

  var req = http.request(options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      result += chunk;
    });
    
    res.on('end', function() {
      if (res.statusCode !== 200) {
        callback('Error >> HTTP '+res.statusCode+' Response from "'+channels+'"');
      } else {
        console.log('Success!');
        data = JSON.parse(result);
        callback(null, data);
      }

    });
  });

  req.on('error', function(e) {
    callback('Error');
  });
  
  req.end();

};

rdb.smembers('channels', function (err, channels) {
  if (err) {
    return console.log(err);
  }

  if (!channels || !channels.length) {
    return console.log('Error >> No channels');
  }
  
  getLiveStream(channels, function(err, result) {
    var live_channels = [];

    if (err) {
      return console.log(err);
    }

    var setOffline = function(offline, i) {
      rdb.zadd(['streams', 0, offline[i]], function(err, object) {
        if (err) {
          console.log('zadd >> '+err);
        } else {
          console.log('Offline >> '+offline[i]);
        }
      });
    };

    var setOnline = function(result, i) {
      console.log('Online >> '+result[i].channel.login);
      live_channels.push(result[i].channel.login);
      rdb.zadd(['streams', result[i].channel_count, result[i].channel.login], function(err, object) {
        if (err) {
          console.log('zadd >> '+err);
        }
      });
      rdb.set('channels:'+result[i].channel.login+':title', result[i].channel.status, function(err, response) {
        if (err) {
          console.log('SET ERROR >> '+err);
        }
        console.log('RESULT >> '+result[i].channel.login);
      });

      // set channels we didn't get data from to offline.
      if (i == result.length - 1) {
        var offline_channels = channels;
        var offline = _.without(offline_channels, live_channels);
        for (var len = offline.length, j = 0; j < len; ++j) {
          setOffline(offline, j);
        }
      }

    };

    if (result.length) {
      for (var len = result.length, i = 0; i < len; ++i) {
        if (result[i]) {
          setOnline(result, i);
        }
      }
    }
  
  });
});

var streams = [];

var saveLiveStreams = function(streams) {
  data = JSON.stringify(streams);
  rdb.set('streams:live', data, function(err, result) {
    if (err) console.log('ERROR >> '+err);
  });
};

var getChannelTitle = function(j, loop, len, channel, callback) {
  rdb.get('channels:'+channel+':title', function(err, result) {
    if (err) {
      console.log('GET ERROR >> '+err);
    }
    if (result && result !== 'null') {
      streams[j].title = result;
    } else {
      streams[j].title = streams[j].name;
    }
    callback(loop);
  });
};

rdb.zrevrange('streams', 0, 7, 'withscores', function(err, result) {
  if (err || !result.length) {
    console.log(err || 'Error >> No stream scores found.');
    render(null);
  }

  if (result.length) {
    var j = 0;

    for(var len = result.length, i = 0; i <= len - 2; i += 2) {
      // redis returns data in a single array.
      // [field1, score1, field2, score2, etc..]
      // so we step by 2
      channel_name = result[i];
      channel_views = result[i+1];

      if (channel_views == 0) {
        // there are fewer than 8 live streams.
        break;
      }
      
      // create objects in the streams[] array.
      streams[j] = {};
      streams[j].name = channel_name;
      streams[j].views = channel_views;
      getChannelTitle(j, i, len, result[i], function(loop) {
        // if next loop has 0 views or end of loop, render
        if (result[loop+3] == 0 || loop == len - 2) {
          saveLiveStreams(streams);
        }
      });
      ++j;
    }
  }
});

setTimeout(function() {
  process.exit();
}, 20000);
