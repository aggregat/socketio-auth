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
 * @param {Number} [config.timeout=1000] - amount of millisenconds to wait for a client to
 * authenticate before disconnecting it. A value of 'none' means no connection timeout.
 */
module.exports = function socketIOAuth(io, config) {
  config = config || {};
  var timeout = config.timeout || 1000;
  var postAuthenticate = config.postAuthenticate || null;

  _.each(io.nsps, forbidConnections);
  io.on('connection', function(socket) {

    socket.auth = false;
    socket.on('authentication', function(data, authenticationDone) {

      config.authenticate(socket, data, function(err, success) {
        if (success) {
          debug('Authenticated socket %s', socket.id);
          socket.auth = true;

          _.each(io.nsps, function(nsp) {
            restoreConnection(nsp, socket);
          });

          async.waterfall([function(nextStep) {
                             socket.emit('authenticated',
                                         success,
                                         function() {
                                           nextStep();
                                         });
                           },
                           function(nextStep) {

                             if (postAuthenticate) {
                               postAuthenticate(socket,
                                                data,
                                                function() {
                                                  nextStep();
                                                });
                             }
                             else {
                               nextStep();
                             }
                           }
                          ],
                          function() {

                            if (_.isFunction(authenticationDone)) {
                              authenticationDone(null,
                                                 success);
                            }
                          });
        } else {

          if (err) {
            debug('Authentication error socket %s: %s', socket.id, err.message);
          }
          else {
            debug('Authentication failure socket %s', socket.id);
          }

          var message = (err ? err.message : 'Authentication failure');

          async.waterfall([function(nextStep) {

                             socket.emit('unauthorized',
                                         {message: message},
                                         function() {
                                           nextStep();
                                         });
                           },
                           function(nextStep) {
                             socket.disconnect();
                             nextStep();
                           }
                          ],
                          function() {

                            if (_.isFunction(authenticationDone)) {
                              authenticationDone(message,
                                                 success);
                            }
                          });
        }
      });
    });

    if (timeout !== 'none') {
      setTimeout(function() {
          // If the socket didn't authenticate after connection, disconnect it
          if (!socket.auth) {
            debug('Disconnecting socket %s', socket.id);
            socket.disconnect('unauthorized');
          }
        }, timeout);
    }

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
