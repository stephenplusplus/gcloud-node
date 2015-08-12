/*!
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*!
 * @module compute/network
 */

'use strict';

var format = require('string-format-obj');
var is = require('is');

/**
 * @type {module:common/util}
 * @private
 */
var util = require('../common/util.js');

/*! Developer Documentation
 *
 * @param {module:compute} compute - The Compute module this network belongs to.
 * @param {string} name - Network name.
 */
/**
 * A Network object allows you to interact with a Google Compute Engine network.
 *
 * @constructor
 * @alias module:compute/network
 *
 * @example
 * var gcloud = require('gcloud')({
 *   keyFilename: '/path/to/keyfile.json',
 *   projectId: 'grape-spaceship-123'
 * });
 *
 * var compute = gcloud.compute();
 *
 * var network = compute.network('network-name');
 */
function Network(compute, name) {
  this.compute = compute;
  this.name = name;

  this.formattedName = Network.formatName_(compute, name);
}

/**
 * Format a network's name how the API expects.
 *
 * @param {module:compute} compute - The Compute object this network belongs to.
 * @param {string} name - The name of the network.
 * @return {string} - The formatted name.
 */
Network.formatName_ = function(compute, name) {
  return format('projects/{projectId}/global/networks/{name}', {
    projectId: compute.projectId,
    name: name
  });
};

/**
 * Create a firewall rule for this network. For a detailed description of
 * method's options see [API reference](https://goo.gl/kTMHep).
 *
 * @param {string} name - Name of the firewall.
 * @param {object} config - Configuration object. See a
 *     [Firewall resource](https://goo.gl/7FpjXA) for detailed information.
 * @param {function} callback - The callback function.
 *
 * @example
 * function callback(err, firewall, operation, apiResponse) {
 *   // `firewall` is a Firewall object.
 *
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * }
 *
 * var config = {
 *   allowed: [
 *     {
 *       IPProtocol: 'tcp',
 *       ports: ['3000']
 *     }
 *   ],
 *   sourceRanges: ['0.0.0.0/0'],
 *   targetTags: ['tcp-3000-tag']
 * };
 *
 * network.createFirewall('tcp-3000', config, callback);
 */
Network.prototype.createFirewall = function(name, config, callback) {
  config = config || {};
  config.network = this.formattedName;

  this.compute.createFirewall(name, config, callback);
};

/**
 * Delete the network.
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * network.delete(function(err, operation, apiResponse) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
Network.prototype.delete = function(callback) {
  var compute = this.compute;

  callback = callback || util.noop;

  this.makeReq_('DELETE', '', null, null, function(err, resp) {
    if (err) {
      callback(err, null, resp);
      return;
    }

    var operation = compute.operation(resp.name);
    operation.metadata = resp;

    callback(null, operation, resp);
  });
};

/**
 * Get a reference to a Google Compute Engine firewall in this network.
 *
 * @param {string} name - Name of the existing firewall.
 *
 * @example
 * var firewall = network.firewall('firewall-name');
 */
Network.prototype.firewall = function(name) {
  var firewall = this.compute.firewall(name);

  firewall.metadata = {
    network: this.formattedName
  };

  return firewall;
};

/**
 * Get a list of firewall rules for this network.
 *
 * @param {object=} options - Firewall search options.
 * @param {boolean} options.autoPaginate - Have pagination handled
 *     automatically. Default: true.
 * @param {number} options.maxResults - Maximum number of firewalls to return.
 * @param {string} options.pageToken - A previously-returned page token
 *     representing part of the larger set of results to view.
 * @param {function} callback - The callback function.
 *
 * @example
 * network.getFirewalls(function(err, firewalls) {
 *   // `firewalls` is an array of `Firewall` objects.
 * });
 *
 * //-
 * // To control how many API requests are made and page through the results
 * // manually, set `autoPaginate` to `false`.
 * //-
 * function callback(err, firewalls, nextQuery, apiResponse) {
 *   if (nextQuery) {
 *     // More results exist.
 *     network.getFirewalls(nextQuery, callback);
 *   }
 * }
 *
 * network.getFirewalls({
 *   autoPaginate: false
 * }, callback);
 *
 * //-
 * // Get the firewalls from your project as a readable object stream.
 * //-
 * network.getFirewalls()
 *   .on('error', console.error)
 *   .on('data', function(firewall) {
 *     // `firewall` is a `Firewall` object.
 *   })
 *   .on('end', function() {
 *     // All firewalls retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * network.getFirewalls()
 *   .on('data', function(firewall) {
 *     this.end();
 *   });
 */
Network.prototype.getFirewalls = function(options, callback) {
  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  options = options || {};
  options.filter = 'network eq .*' + this.formattedName;

  return this.compute.getFirewalls(options, callback);
};

/**
 * Get the network's metadata.
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * network.getMetadata(function(err, metadata, apiResponse) {});
 */
Network.prototype.getMetadata = function(callback) {
  var self = this;

  callback = callback || util.noop;

  this.makeReq_('GET', '', null, null, function(err, resp) {
    if (err) {
      callback(err, null, resp);
      return;
    }

    self.metadata = resp;

    callback(null, self.metadata, resp);
  });
};

/**
 * Make a new request object from the provided arguments and wrap the callback
 * to intercept non-successful responses.
 *
 * @private
 *
 * @param {string} method - Action.
 * @param {string} path - Request path.
 * @param {*} query - Request query object.
 * @param {*} body - Request body contents.
 * @param {function} callback - The callback function.
 */
Network.prototype.makeReq_ = function(method, path, query, body, callback) {
  path = '/global/networks/' + this.name + path;
  this.compute.makeReq_(method, path, query, body, callback);
};

module.exports = Network;
