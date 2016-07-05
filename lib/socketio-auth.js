'use strict';

var _ = require('lodash');
var async = require('async');
var debug = require('debug')('socketio-auth');

/**
 * Adds connection listeners to the given socket.io server, so clients
 * are forced to authenticate before they can receive events.
 *
 * @param {Object} io - the socket.io server socket
 *
 * @param {Object} config - configuration values
 * @param {Function} config.authenticate - indicates if authentication was successfull
 * @param {Function} config.postAuthenticate=noop -  called after the client is authenticated
 */
module.exports = function socketIOAuth(io, config) {
  config = config || {};
  var postAuthenticate = config.postAuthenticate || function(socket, data, done) { done(null); };

  io.on('connection', function(socket) {

    socket.auth = false;
    socket.on('authentication', function(data, authenticationDone) {

      async.waterfall([function(nextStep) {

                         socket.auth = false;
                         _.each(io.nsps,
                                forbidConnections);

                         config.authenticate(socket,
                                             data,
                                             nextStep);
                       },
                       function(nextStep) {

                         socket.auth = true;
                         _.each(io.nsps,
                                function(nsp) {
                                  restoreConnection(nsp, socket);
                                });

                         postAuthenticate(socket,
                                          data,
                                          nextStep);
                       }
                      ],
                      authenticationDone);
    });
  });
};

/**
 * Set a listener so connections from unauthenticated sockets are not
 * considered when emitting to the namespace. The connections will be
 * restored after authentication succeeds.
 */
function forbidConnections(nsp) {
  nsp.on('connect', function(socket) {
    if (!socket.auth) {
      debug('removing socket from %s', nsp.name);
      delete nsp.connected[socket.id];
    }
  });
}

/**
 * If the socket attempted a connection before authentication, restore it.
 */
function restoreConnection(nsp, socket) {
  if (_.findWhere(nsp.sockets, {id: socket.id})) {
    debug('restoring socket to %s', nsp.name);
    nsp.connected[socket.id] = socket;
  }
}
