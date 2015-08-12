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
 * @module compute/firewall
 */

'use strict';

/**
 * @type {module:common/util}
 * @private
 */
var util = require('../common/util.js');

/*! Developer Documentation
 *
 * @param {module:compute} compute - Compute object this firewall belongs to.
 * @param {string} name - Name of the firewall.
 */
/**
 * A Firewall object allows you to interact with a Google Compute Engine
 * firewall.
 *
 * @constructor
 * @alias module:compute/firewall
 *
 * @example
 * var gcloud = require('gcloud')({
 *   keyFilename: '/path/to/keyfile.json',
 *   projectId: 'grape-spaceship-123'
 * });
 *
 * var compute = gcloud.compute();
 *
 * var firewall = compute.firewall('tcp-3000');
 */
function Firewall(compute, name) {
  this.compute = compute;
  this.name = name;

  this.metadata = {
    network: 'global/networks/default'
  };
}

/**
 * Delete the firewall.
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * firewall.delete(function(err, operation, apiResponse) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
Firewall.prototype.delete = function(callback) {
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
 * Get the firewall's metadata.
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * firewall.getMetadata(function(err, metadata, apiResponse) {});
 */
Firewall.prototype.getMetadata = function(callback) {
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
 * Set the firewall's metadata.
 *
 * @param {object} metadata - Firewall metadata. See a
 *     [Firewall resource](https://goo.gl/7FpjXA) for detailed information.
 * @param {function=} callback - The callback function.
 *
 * @example
 * var metadata = {
 *   description: 'New description'
 * };
 *
 * firewall.setMetadata(metadata, function(err, operation, apiResponse) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
Firewall.prototype.setMetadata = function(metadata, callback) {
  var self = this;

  callback = callback || util.noop;

  metadata = metadata || {};
  metadata.name = this.name;
  metadata.network = this.metadata.network;

  this.makeReq_('PATCH', '', null, metadata, function(err, resp) {
    if (err) {
      callback(err, null, resp);
      return;
    }

    var operation = self.compute.operation(resp.name);
    operation.metadata = resp;

    callback(null, operation, resp);
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
Firewall.prototype.makeReq_ = function(method, path, query, body, callback) {
  path = '/global/firewalls/' + this.name + path;
  this.compute.makeReq_(method, path, query, body, callback);
};

module.exports = Firewall;
