# socketio-auth [![Build Status](https://secure.travis-ci.org/facundoolano/socketio-auth.png)](http://travis-ci.org/facundoolano/socketio-auth)

This module provides hooks to implement authentication in [socket.io](https://github.com/Automattic/socket.io) without using querystrings to send credentials, which is not a good security practice.

Client:
```javascript
var socket = io.connect('http://localhost');
socket.on('connect', function(){
  socket.emit('authentication', {username: "John", password: "secret"},
              function(err) {
                // ...
              });
});
```

Server:
```javascript
var io = require('socket.io').listen(app);

require('socketio-auth')(io, {
  authenticate: function (socket, data, callback) {
    //get credentials sent by the client
    var username = data.username;
    var password = data.password;

    db.findUser('User', {username:username, password:password}, function(err, user) {

      //inform the callback of auth success/failure
      return callback(err || !user
                      ? "User not found"
                      : null);
    });
  }
});
```

The client should send an `authentication` event right after connecting, including whatever credentials are needed by the server to identify the user (i.e. user/password, auth token, etc.). The `authenticate` function receives those same credentials in 'data', and the actual 'socket' in case header information like the origin domain is important, and uses them to authenticate.

## Configuration

To setup authentication for the socket.io connections, just pass the server socket to socketio-auth with a configuration object:

```javascript
var io = require('socket.io').listen(app);

require('socketio-auth')(io, {
  authenticate: authenticate,
  postAuthenticate: postAuthenticate
});
```

The supported parameters are:

* `authenticate`: The only required parameter. It's a function that takes the data sent by the client and calls a callback indicating if authentication was successfull:

```javascript
function authenticate(socket, data, callback) {
  var username = data.username;
  var password = data.password;

  db.findUser('User', {username:username, password:password}, function(err, user) {
    //inform the callback of auth success/failure
    return callback(err || !user
                    ? "User not found"
                    : null);
  });
}
```
* `postAuthenticate`: a function to be called after the client is authenticated. It's useful to keep track of the user associated with a client socket:

```javascript
function postAuthenticate(socket, data, done) {
  var username = data.username;

  db.findUser('User', {username:username}, function(err, user) {
    socket.client.user = user;
    done();
  });
}
```
