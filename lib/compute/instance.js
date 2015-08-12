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
 * @module compute/instance
 */

'use strict';

var extend = require('extend');
var is = require('is');

/**
 * @type {module:compute/disk}
 * @private
 */
var Disk = require('./disk.js');

/**
 * @type {module:common/util}
 * @private
 */
var util = require('../common/util.js');

/*! Developer Documentation
 *
 * @param {module:zone} zone - Compute object this instance belongs to.
 * @param {string} name - Name of the instance.
 */
/**
 * An Instance object allows you to interact with a Google Compute Engine
 * instance.
 *
 * @constructor
 * @alias module:compute/instance
 *
 * @example
 * var gcloud = require('gcloud')({
 *   keyFilename: '/path/to/keyfile.json',
 *   projectId: 'grape-spaceship-123'
 * });
 *
 * var compute = gcloud.compute();
 *
 * var zone = compute.zone('zone-name');
 *
 * var instance = zone.instance('instance1');
 */
function Instance(zone, name) {
  this.zone = zone;
  this.name = name;
}

/**
 * Attach a disk to the instance.
 *
 * @throws {Error} if a {module:compute/disk} is not provided.
 *
 * @param {module:compute/disk} disk - The disk to attach.
 * @param {object=} options - Disk attach options. See the
 *     [API documentation](https://goo.gl/mDlhkF) for detailed information.
 * @param {function} callback - The callback function.
 *
 * @example
 * var disk = zone.disk('my-disk');
 *
 * function callback(err, operation, apiResponse) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * }
 *
 * instance.attachDisk(disk, callback);
 *
 * //-
 * // Provide an options object to customize the request.
 * //-
 * var options = {
 *   autoDelete: true,
 *   readOnly: true
 * };
 *
 * instance.attachDisk(disk, options, callback);
 */
Instance.prototype.attachDisk = function(disk, options, callback) {
  if (!(disk instanceof Disk)) {
    throw new Error('A Disk object must be provided.');
  }

  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  var zone = this.zone;

  var body = extend({}, options, {
    source: disk.formattedName
  });

  this.makeReq_('POST', '/attachDisk', null, body, function(err, resp) {
    if (err) {
      callback(err, null, resp);
      return;
    }

    var operation = zone.operation(resp.name);
    operation.metadata = resp;

    callback(null, operation, resp);
  });
};

/**
 * Delete the instance.
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * instance.delete(function(err, operation, apiResponse) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
Instance.prototype.delete = function(callback) {
  var zone = this.zone;

  callback = callback || util.noop;

  this.makeReq_('DELETE', '', null, true, function(err, resp) {
    if (err) {
      callback(err, null, resp);
      return;
    }

    var operation = zone.operation(resp.name);
    operation.metadata = resp;

    callback(null, operation, resp);
  });
};

/**
 * Detach a disk from the instance.
 *
 * @param {string} deviceName - The name of the device to detach.
 * @param {function} callback - The callback function.
 *
 * @example
 * instance.detachDisk('my-device', function(err, operation, apiResponse) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
Instance.prototype.detachDisk = function(deviceName, callback) {
  var zone = this.zone;

  var query = {
    deviceName: deviceName
  };

  this.makeReq_('POST', '/detachDisk', query, null, function(err, resp) {
    if (err) {
      callback(err, null, resp);
      return;
    }

    var operation = zone.operation(resp.name);
    operation.metadata = resp;

    callback(null, operation, resp);
  });
};

/**
 * Get the instances's metadata.
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * instance.getMetadata(function(err, metadata, apiResponse) {});
 */
Instance.prototype.getMetadata = function(callback) {
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
 * Returns the serial port output for the instance.
 *
 * @param {number=} port - The port from which the output is retrieved (1-4).
 *    Default: `1`.
 * @param {function} callback - The callback function.
 *
 * @example
 * instance.getSerialPortOutput(4, function(err, output, apiResponse) {});
 */
Instance.prototype.getSerialPortOutput = function(port, callback) {
  if (is.fn(port)) {
    callback = port;
    port = 1;
  }

  var query = {
    port: port
  };

  this.makeReq_('GET', '/serialPort', query, null, function(err, resp) {
    if (err) {
      callback(err, null, resp);
      return;
    }

    callback(null, resp.content, resp);
  });
};

/**
 * Get the instance's tags and their fingerprint.
 *
 * @param {function} callback - The callback function.
 *
 * @example
 * instance.getTags(function(err, tags, fingerprint) {});
 */
Instance.prototype.getTags = function(callback) {
  this.getMetadata(function(err, metadata) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, metadata.tags.items, metadata.tags.fingerprint);
  });
};

/**
 * Reset the instance.
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * instance.reset(function(err, operation, apiResponse) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
Instance.prototype.reset = function(callback) {
  var zone = this.zone;

  callback = callback || util.noop;

  this.makeReq_('POST', '/reset', null, null, function(err, resp) {
    if (err) {
      callback(err, null, resp);
      return;
    }

    var operation = zone.operation(resp.name);
    operation.metadata = resp;

    callback(null, operation, resp);
  });
};

/**
 * Set the instance's tags.
 *
 * @param {string[]} tags - The new tags for the instance.
 * @param {string} fingerprint - The current tags fingerprint. An up-to-date
 *     fingerprint must be provided.
 * @param {function=} callback - The callback function.
 *
 * @example
 * instance.getTags(function(err, tags, fingerprint) {
 *   tags.push('new-tag');
 *
 *  instance.setTags(tags, fingerprint, function(err, operation, apiResponse) {
 *     // `operation` is an Operation object that can be used to check the
 *     //  status of the request.
 *   });
 * });
 */
Instance.prototype.setTags = function(tags, fingerprint, callback) {
  var zone = this.zone;

  callback = callback || util.noop;

  var body = {
    items: tags,
    fingerprint: fingerprint
  };

  this.makeReq_('POST', '/setTags', null, body, function(err, resp) {
    if (err) {
      callback(err, null, resp);
      return;
    }

    var operation = zone.operation(resp.name);
    operation.metadata = resp;

    callback(null, operation, resp);
  });
};

/**
 * Start the instance.
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * instance.start(function(err, operation, apiResponse) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
Instance.prototype.start = function(callback) {
  var zone = this.zone;

  callback = callback || util.noop;

  this.makeReq_('POST', '/start', null, null, function(err, resp) {
    if (err) {
      callback(err, null, resp);
      return;
    }

    var operation = zone.operation(resp.name);
    operation.metadata = resp;

    callback(null, operation, resp);
  });
};

/**
 * Stop the instance.
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * instance.stop(function(err, operation) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
Instance.prototype.stop = function(callback) {
  var zone = this.zone;

  callback = callback || util.noop;

  this.makeReq_('POST', '/stop', null, null, function(err, resp) {
    if (err) {
      callback(err, null, resp);
      return;
    }

    var operation = zone.operation(resp.name);
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
Instance.prototype.makeReq_ = function(method, path, query, body, callback) {
  path = '/instances/' + this.name + path;
  this.zone.makeReq_(method, path, query, body, callback);
};

module.exports = Instance;
