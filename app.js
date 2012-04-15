
/**
 * Module dependencies.
 */

var express = require('express'),
  config = require('./config'),
  redis = require('redis'),
  rdb = require('./db').rdb,
  sio = require('socket.io'),
  sessionStore = require('./db').sessionStore,
  check = require('validator').check,
  sanitize = require('validator').sanitize;
  

var app = module.exports = express.createServer(),
  site = require('./site');

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('view options', { layout: false });
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ store: sessionStore, secret: 'secret', key: 'express.sid', cookie: { maxAge: 30 * 24 * 60 * 60 * 1000} })); // expire in 30 days
  app.use(app.router);
});

app.configure('development', function(){
  app.use(express.static(__dirname + '/public'));  
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  var oneYear = 31557600000;
  app.use(express.static(__dirname + '/public', { maxAge: oneYear }));
  app.use(express.errorHandler()); 
});

rdb.on('error', function (err) {
  console.log('Error >> ' + err);
});

// Routes

app.get('/', site.index);

app.get('/javascripts/channel.js', function(req, res) {
  res.header('Content-Type', 'application/javascript');
  res.render('channel.ejs', {
    url: config.tcp.url
  });
});

app.get('/:channel', function(req, res) {
  if (req.session.user) {
    var session = {
     'name': req.session.user.name,
     'code': req.session.user.code,
     'league': req.session.user.league
    };
  } else {
    var session = null;
  }

  var channel = sanitize(req.params.channel).xss();

  res.render('channel', {
    session: session,
    channel: channel
  });
});

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(config.http.port);
  console.log("Express server listening on port %d", app.address().port);
}

var io = sio.listen(app);
require('./io')(io);


function sigterm_handler() {
    // clean up channel users set
    var multi = rdb.multi();
    rdb.smembers('channels', function(err, channels) {
      for (var len = channels.length, i = 0; i < len; ++i) {
        multi.del('channels:'+channels[i]+':users', redis.print);
      }
      if (i == len - 1) {
        multi.exec(function(err, replies) {
          console.log(replies);
          process.exit(0);
        });
      }
    });
}

process.on('SIGTERM', sigterm_handler);

