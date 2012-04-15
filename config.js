if (process.env.NODE_ENV === 'production') {
  var fs = require('fs');
  var env = JSON.parse(fs.readFileSync('/home/dotcloud/environment.json', 'utf-8'));
  var http_port = 8080;
  var tcp_host = env['DOTCLOUD_WWW_NODE_HOST'];
  var tcp_port = env['DOTCLOUD_WWW_NODE_PORT'];
  var tcp_url = 'http://www.timingtv.com';
} else {
  var http_port = 8080;
  var tcp_host = 'localhost';
  var tcp_port = '';
  var tcp_url = 'http://localhost';
}

var development = {
  http: {
    port: http_port
  },
  tcp: {
    host: tcp_host,
    port: tcp_port,
    url: tcp_url
  }
};

var production = {
  http: {
    port: http_port
  },
  tcp: {
    host: tcp_host,
    port: tcp_port,
    url: tcp_url
  },
  redis: {
    host: 'localhost',
    port:  0000,
    password:  ''
  }
};

module.exports = process.env.NODE_ENV === 'production' ? production : development;
