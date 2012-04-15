var rdb = require('./db').rdb,
  sessionStore = require('./db').sessionStore,
  check = require('validator').check,
  sanitize = require('validator').sanitize;

var socketio = function(io) {

  io.set("transports", ["xhr-polling"]);
  io.set("polling duration", 10);

  var path = require('path');
  var HTTPPolling = require(path.join(
    path.dirname(require.resolve('socket.io')),'lib', 'transports','http-polling')
  );
  var XHRPolling = require(path.join(
    path.dirname(require.resolve('socket.io')),'lib','transports','xhr-polling')
  );

  XHRPolling.prototype.doWrite = function(data) {
    HTTPPolling.prototype.doWrite.call(this);

    var headers = {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Content-Length': (data && Buffer.byteLength(data)) || 0
    };

    if (this.req.headers.origin) {
      headers['Access-Control-Allow-Origin'] = '*';
      if (this.req.headers.cookie) {
        headers['Access-Control-Allow-Credentials'] = 'true';
      }
    }

    this.response.writeHead(200, headers);
    this.response.write(data);
    this.log.debug(this.name + ' writing', data);
  };  

  var parseCookie = require('connect').utils.parseCookie;
  io.set('authorization', function (data, accept) {
    if (data.headers.cookie) {
      data.cookie = parseCookie(data.headers.cookie);
      data.sessionID = data.cookie['express.sid'];
      data.sessionStore = sessionStore;
      sessionStore.load(data.sessionID, function(err, session) {
        if (err) {
          accept('Error', false);
        } else {
          data.session = session;
          accept(null, true);
        }
      });
    } else {
        return accept('No cookie transmitted.', false);
    }
  });

  io.sockets.on('connection', function (socket) {
    var hs = socket.handshake;
    var leagues = {
      '1': 'master',
      '2': 'master',
      '3': 'diamond',
      '4': 'platinum',
      '5': 'gold',
      '6': 'silver',
      '7': 'bronze'
    };

    var addUserToChannel = function() {
        var chat_users_html = '<li id="'+socket.id+'"><a href="#"><span class="'+
                              leagues[hs.session.user.league]+
                              ' pull-left"></span><p class="bottomup">'+
                              hs.session.user.name+'.'+hs.session.user.code+'</p></a></li>';

        rdb.sadd('channels:'+socket.channel+':users', hs.sessionID, function(err, result) {
          if (err || !result) {
            console.log('Error >> Could not save user to channel users list');
            if (err) console.log(err);
          }
        });

        rdb.set('users:'+hs.sessionID+':chathtml', chat_users_html, function(err, result) {
          if (err || !result) {
            console.log('Error >> Could not save chat html to users key');
          }
        });
        io.sockets.in(socket.channel).emit('add user', chat_users_html);

    };

    if (hs.session.user) {
      socket.emit('user info', { 'name': hs.session.user.name, 'code': hs.session.user.code , 'league': hs.session.user.league });
    }

    socket.on('set channel', function(channel) {
      channel = sanitize(channel).xss();
      socket.join(channel);
      socket.channel = channel;
      
      // return client last 30 messages from log
      rdb.lrange('channels:'+channel+':chatlog', 0, 29, function(err, msgs) {
        if (err) return console.log(err);
        if (msgs) {
          socket.emit('chat log', msgs);
        }
      });

      // return users in the channel in the form of html
      rdb.smembers('channels:'+channel+':users', function(err, users) {
        if (err || !users) {
          console.log('Error >> Could not find users in channel "'+channel+'".');
        } else {
          for (len = users.length, i = 0; i < len; ++i) {
            rdb.get('users:'+users[i]+':chathtml', function(err, chathtml) {
              if (err || !chathtml) {
                console.log('Error >> Could not find chathtml for user "'+users[i]+'".');
              }
              socket.emit('add user', chathtml);
            });
          }
        }
      });

      if (hs.session.user) {
        addUserToChannel();
      }

    });

    socket.on('user', function(user) {
      if (user) {
        // sanitize
        try {
            check(user.name).isAlpha().notEmpty();
            check(user.code).isNumeric().notEmpty().len(3,3);
            check(user.league).notEmpty().notNull();
        } catch (e) {
            socket.emit('user', null);
            return;
        }
    
        hs.session['user'] = user;
        sessionStore.set(hs.sessionID, hs.session, function(err, session) {
          if (err || !session) {
            console.log('Could not store user to sessionStore');
          }
        });
        socket.emit('user', hs.session.user);
        addUserToChannel();

      } else {
        socket.emit('user', null);
      }
    });

    socket.on('message', function (msg) {
      if (hs.session) {
        var clean_message = sanitize(msg.txt).xss()

        socket.broadcast.to(msg.channel).emit('new message', {
          'name': hs.session.user.name,
          'code': hs.session.user.code,
          'league': hs.session.user.league,
          'msg': clean_message
        });

        // cache last 30 lines of chat.
        rdb.multi()
           .rpush('channels:'+msg.channel+':chatlog', '<li><span class="'+leagues[hs.session.user.league]+
                               '"></span>'+
                               hs.session.user.name+'.'+hs.session.user.code+
                               ': '+clean_message+'</li>')
           .ltrim('channels:'+msg.channel+':chatlog', -30, -1)
           .exec(function(err, replies) {
                if (err) console.log(err)
           });
      }
    });
    socket.on('disconnect', function () {
      if (hs.session.user) {
        rdb.srem('channels:'+socket.channel+':users', hs.sessionID, function(err, result) {
          if (err || !result) {
            console.log('Error >> Could not remove "'+hs.sessionID+'" from channel users set');
            if (err) console.log(err);
          }
        });
        socket.broadcast.to(socket.channel).emit('remove user', socket.id);
      }
      socket.leave(socket.channel);
    });
  });

}

module.exports = socketio;
