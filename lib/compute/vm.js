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
 * @module compute/vm
 */

'use strict';

var events = require('events');
var extend = require('extend');
var is = require('is');
var nodeutil = require('util');

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
 * @param {module:compute} compute - Compute object this instance belongs to.
 * @param {module:zone} zone - Zone object this instance belongs to.
 * @param {string} name - Name of the instance.
 */
/**
 * An Instance object allows you to interact with a Google Compute Engine
 * instance.
 *
 * @constructor
 * @alias module:compute/vm
 *
 * @example
 * var gcloud = require('gcloud')({
 *   keyFilename: '/path/to/keyfile.json',
 *   projectId: 'grape-spaceship-123'
 * });
 *
 * var gce = gcloud.compute();
 *
 * var zone = gce.zone('zone-name');
 *
 * var vm = zone.vm('vm-name');
 */
function VM(compute, zone, name) {
  events.EventEmitter.call(this);

  this.compute = compute;
  this.zone = zone;
  this.name = name;
}

nodeutil.inherits(VM, events.EventEmitter);

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
 * vm.attachDisk(disk, callback);
 *
 * //-
 * // Provide an options object to customize the request.
 * //-
 * var options = {
 *   autoDelete: true,
 *   readOnly: true
 * };
 *
 * vm.attachDisk(disk, options, callback);
 */
VM.prototype.attachDisk = function(disk, options, callback) {
  if (!(disk instanceof Disk)) {
    throw new Error('A Disk object must be provided.');
  }

  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  var body = extend({}, options, {
    source: disk.formattedName
  });

  this.makeReq_('POST', '/attachDisk', null, body, callback);
};

/**
 * Delete the instance.
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * vm.delete(function(err, operation, apiResponse) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
VM.prototype.delete = function(callback) {
  this.makeReq_('DELETE', '', null, null, callback || util.noop);
};

/**
 * Detach a disk from the instance.
 *
 * @param {string} deviceName - The name of the device to detach.
 * @param {function} callback - The callback function.
 *
 * @example
 * vm.detachDisk('my-device', function(err, operation, apiResponse) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
VM.prototype.detachDisk = function(deviceName, callback) {
  var query = {
    deviceName: deviceName
  };

  this.makeReq_('POST', '/detachDisk', query, null, callback);
};

/**
 * Get the instances's metadata.
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * vm.getMetadata(function(err, metadata, apiResponse) {});
 */
VM.prototype.getMetadata = function(callback) {
  var self = this;

  callback = callback || util.noop;

  this.makeReq_('GET', '', null, null, function(err, _, resp) {
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
 * vm.getSerialPortOutput(4, function(err, output, apiResponse) {});
 */
VM.prototype.getSerialPortOutput = function(port, callback) {
  if (is.fn(port)) {
    callback = port;
    port = 1;
  }

  var query = {
    port: port
  };

  this.makeReq_('GET', '/serialPort', query, null, function(err, _, resp) {
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
 * vm.getTags(function(err, tags, fingerprint) {});
 */
VM.prototype.getTags = function(callback) {
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
 * vm.reset(function(err, operation, apiResponse) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
VM.prototype.reset = function(callback) {
  this.makeReq_('POST', '/reset', null, null, callback || util.noop);
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
 * vm.getTags(function(err, tags, fingerprint) {
 *   tags.push('new-tag');
 *
 *  vm.setTags(tags, fingerprint, function(err, operation, apiResponse) {
 *     // `operation` is an Operation object that can be used to check the
 *     //  status of the request.
 *   });
 * });
 */
VM.prototype.setTags = function(tags, fingerprint, callback) {
  var body = {
    items: tags,
    fingerprint: fingerprint
  };

  this.makeReq_('POST', '/setTags', null, body, callback || util.noop);
};

/**
 * Start the instance.
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * vm.start(function(err, operation, apiResponse) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
VM.prototype.start = function(callback) {
  this.makeReq_('POST', '/start', null, null, callback || util.noop);
};

/**
 * Stop the instance.
 *
 * @param {function=} callback - The callback function.
 *
 * @example
 * vm.stop(function(err, operation) {
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
VM.prototype.stop = function(callback) {
  this.makeReq_('POST', '/stop', null, null, callback || util.noop);
};

/**
 * VM objects can be accessed without knowing the zone ahead of time. This is to
 * allow for a nicer API. The cost is this extra step where we have to try to
 * match an instances in the project by name.
 *
 * If anything other than exactly one match is returned, the user's callback
 * receives an error.
 *
 * If one is matched, it is assigned as the zone on this instance, so that this
 * process is not required for the user's next operation.
 *
 * @private
 *
 * @param {function} callback - The callback function.
 */
VM.prototype.getZone_ = function(callback) {
  var self = this;

  if (this.zone) {
    setImmediate(function() {
      callback(null, self.zone);
    });
    return;
  }

  this.once('zone-found', this.getZone_.bind(this, callback));

  if (this.gettingZone_) {
    return;
  }

  this.gettingZone_ = true;

  var notFoundError = new Error([
    'Virtual machine "' + this.name + '" not found.'
  ].join(''));
  notFoundError.code = 'VM_NOT_FOUND';

  var tooManyError = new Error([
    'Multiple virtual machines named "' + this.name + '" found.',
    'Access your virtual machine through a Zone object instead, e.g.',
    '',
    'var vm = gce.zone("us-central1-a").vm("' + this.name + '");'
  ].join('\n'));
  tooManyError.code = 'MULTIPLE_VMS_FOUND';

  this.compute.getVMs({
    filter: 'name eq ' + this.name
  }, function(err, vms) {
    self.gettingZone_ = false;

    if (err) {
      callback(err);
      return;
    }

    if (vms.length === 0) {
      callback(notFoundError);
      return;
    }

    if (vms.length > 1) {
      callback(tooManyError);
      return;
    }

    self.zone = vms[0].zone;
    self.emit('zone-found');
  });
};


/**
 * Make a new request object from the provided arguments and wrap the callback
 * to intercept non-successful responses.
 *
 * Most operations on a VM are long-running. This method handles building an
 * operation and returning it to the user's provided callback. In methods that
 * don't require an operation, we simply don't do anything with the `Operation`
 * object.
 *
 * @private
 *
 * @param {string} method - Action.
 * @param {string} path - Request path.
 * @param {*} query - Request query object.
 * @param {*} body - Request body contents.
 * @param {function} callback - The callback function.
 */
VM.prototype.makeReq_ = function(method, path, query, body, callback) {
  path = '/instances/' + this.name + path;

  this.getZone_(function(err, zone) {
    if (err) {
      callback(err);
      return;
    }

    zone.makeReq_(method, path, query, body, function(err, resp) {
      if (err) {
        callback(err, null, resp);
        return;
      }

      var operation = zone.operation(resp.name);
      operation.metadata = resp;

      callback(null, operation, resp);
    });
  });
};

module.exports = VM;
