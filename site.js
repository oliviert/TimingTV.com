var rdb = require('./db').rdb;

exports.index = function(req, res) {
  var render = function(streams) {
    res.render('index', {
      streams: streams
    });
  };

  rdb.get('streams:live', function(err, streams) {
    if (err) {
      console.log('ERROR >> Could not find live streams');
    }
    if (streams) {
      data = JSON.parse(streams);
      if (data.length) {
        render(data);
      } else {
        render(null);
      }
    } else {
      render(null);
    }
  });
};
