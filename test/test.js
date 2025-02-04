'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

function NamespaceMock(name) {
  this.name = name;
  this.sockets = [];
  this.connected = {};
}

util.inherits(NamespaceMock, EventEmitter);

NamespaceMock.prototype.connect = function(client) {
  this.sockets.push(client);
  this.connected[client.id] = client;
  this.emit('connection', client);
};

function ServerSocketMock () {
  this.nsps = {
    '/User': new NamespaceMock('/User'),
    '/Message': new NamespaceMock('/Message')
  };
}

util.inherits(ServerSocketMock, EventEmitter);

ServerSocketMock.prototype.connect = function(nsp, client) {
  this.emit('connection', client);
  this.nsps[nsp].connect(client);
};

ServerSocketMock.prototype.emit = function(event, data, cb) {
  ServerSocketMock.super_.prototype.emit.call(this, event, data);

  //fakes client acknowledgment
  if (cb) {
    process.nextTick(cb);
  }
};

function ClientSocketMock(id) {
  this.id = id;
  this.client = {};
}
util.inherits(ClientSocketMock, EventEmitter);

ClientSocketMock.prototype.disconnect = function() {
  this.emit('disconnect');
};

function authenticate(socket, data, cb) {
  if (!data.token) {
    cb(new Error('Missing credentials'));
  }

  cb(data.token === 'fixedtoken' ? null : new Error('Authentication failure'));
}

describe('Server socket authentication', function() {
  var server;
  var client;

  beforeEach(function() {
    server = new ServerSocketMock();

    require('../lib/socketio-auth')(server, {
      timeout:80,
      authenticate: authenticate
    });

    client = new ClientSocketMock(5);
  });

  it('Should mark the socket as unauthenticated upon connection', function(done) {
    assert(client.auth === undefined);
    server.connect('/User', client);
    process.nextTick(function() {
      assert(client.auth === false);
      done();
    });
  });

  it('Should not send messages to unauthenticated sockets', function(done) {
    server.connect('/User', client);
    process.nextTick(function() {
      assert(!server.nsps['/User'][5]);
      done();
    });
  });

  it('Should authenticate with valid credentials', function(done) {
    server.connect('/User', client);
    process.nextTick(function() {
      client.emit('authentication', {token: 'fixedtoken'}, function(err) {
                    assert(err === null);
                    assert(client.auth);
                    done();
                  });
    });
  });

  it('Should call post auth function', function(done) {
    server = new ServerSocketMock();
    client = new ClientSocketMock(5);

    var postAuth = function(socket, tokenData, postAuthDone) {
      assert.equal(tokenData.token, 'fixedtoken');
      assert.equal(socket, client);

      postAuthDone();
    };

    require('../lib/socketio-auth')(server, {
      timeout:80,
      authenticate: authenticate,
      postAuthenticate: postAuth
    });

    server.connect('/User', client);

    process.nextTick(function() {
      client.emit('authentication', {token: 'fixedtoken'},
                  function() {
                    done();
                  });
    });
  });

  it('Should send updates to authenticated sockets', function(done) {
    server.connect('/User', client);

    process.nextTick(function() {
      client.emit('authentication', {token: 'fixedtoken'}, function(err) {
                    assert(err === null);
                    assert.equal(server.nsps['/User'].connected[5], client);
                    done();
                  });
    });
  });

  it('Should send error event on invalid credentials', function(done) {
    server.connect('/User', client);

    process.nextTick(function() {
      client.emit('authentication', {token: 'invalid'}, function(err) {
                    assert.equal(err.message, 'Authentication failure');
                    done();
                  });
    });
  });

  it('Should send error event on missing credentials', function(done) {
    server.connect('/User', client);

    process.nextTick(function() {
      client.emit('authentication', {}, function(err) {
                    assert.equal(err.message, 'Missing credentials');
                    done();
                  });
    });
  });

});
