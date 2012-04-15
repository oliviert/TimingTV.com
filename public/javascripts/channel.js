if (window.location.hostname === 'localhost') {
  var ws_host = 'http://localhost';
} else {
  var ws_host = 'http://www.timingtv.com';
}
var socket = io.connect(ws_host);
var leagues = {
  '1': 'grandmaster',
  '2': 'master',
  '3': 'diamond',
  '4': 'platinum',
  '5': 'gold',
  '6': 'silver',
  '7': 'bronze'
};

var chatlog = false;

socket.on('connect', function () {
  socket.emit('set channel', channel);
});

socket.on('chat log', function(log) {
  if (chatlog) {
    return;
  }
  for(var len = log.length, i = 0; i < len; ++i) {
    $('ul.unstyled').append(log[i]);
  }
  chatlog = true;
  var $chat = $('.chat-container');
  setTimeout(function() { 
    $chat.scrollTop(999999);
  }, 100);
});

socket.on('user', function(response) {
  if (response) {
    user = response;
    var $msg = $('input#message-input').val();
    socket.emit('message', {'channel': channel, 'txt': $msg });
    var data = user;
    data['msg'] = $msg;
    message(data);
    $('input#message-input').val('');
  }
});

socket.on('add user', function(user_html) {
  $('ul.dropdown-menu.right.bottom-up').append(user_html);
});

socket.on('remove user', function(id) {
  $('li#'+id).remove();
});

socket.on('new message', message);

function message(data) {
  $('ul.unstyled').append('<li><span class="'+leagues[data.league]+'"></span>'+data.name+'.'+data.code+': '+data.msg+'</li>');
  var $chat = $('.chat-container');
    setTimeout(function() { 
        $chat.scrollTop(999999);
      }, 10);
    }

$(document).ready(function(){
  $('button#save.btn.btn-primary').click(function() {
    console.log('Save button registered');
    var $char_name = $('input#character-name').val();
    var $char_code = $('input#character-code').val();
    var $char_league = $('select#select-league').val();
    
    var success = true;
    try {
      check($char_name).isAlpha().notEmpty();
    } catch (e) {
      $('input#character-name').parent().removeClass('success').addClass('error');
      success = false;
      return;
    }
    if (success) {
      $('input#character-name').parent().removeClass('error').addClass('success');
    }

    success = true;
    try {
      check($char_code).isNumeric().notEmpty().len(3,3);
    } catch (e) {
      $('input#character-code').parent().removeClass('success').addClass('error');
      success = false;
      return;
    }
    if (success) {
      $('input#character-code').parent().removeClass('error').addClass('success');
    }

    success = true;
    try {
      check($char_league).notEmpty().notNull();
    } catch (e) {
      $('select#select-league').parent().removeClass('success').addClass('error');
      success = false;
      return;
    }

    if (success) {
      $('select#select-league').parent().removeClass('error').addClass('success');
    }


    socket.emit('user', {'name': $char_name, 'code': $char_code, 'league': $char_league});


    $('#myModal').modal('hide');
  });

  $('input#message-input').keyup(function(e){
    // press enter to send message
    if(e.which == 13) {
      $msg = $('input#message-input').val();
      if ($msg === '') {
            return;
      }

      if (!user) {
        $('#myModal').modal('show');
        return;
      }

      socket.emit('message', {'channel': channel, 'txt': $msg });
      var data = user;
      data['msg'] = $msg;
      message(data);

      $('input#message-input').val('');
    }
  });
});

