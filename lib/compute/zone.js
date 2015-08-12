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
 * @module compute/zone
 */

'use strict';

var extend = require('extend');
var format = require('string-format-obj');
var gceImages = require('gce-images');
var is = require('is');

/**
 * @type {module:compute/disk}
 * @private
 */
var Disk = require('./disk.js');

/**
 * @type {module:compute/operation}
 * @private
 */
var Operation = require('./operation.js');

/**
 * @type {module:common/streamrouter}
 * @private
 */
var streamRouter = require('../common/stream-router.js');

/**
 * @type {module:compute/vm}
 * @private
 */
var VM = require('./vm.js');

/*! Developer Documentation
 *
 * @param {module:compute} compute - Compute object this zone belongs to.
 * @param {string} name - Name of the zone.
 */
/**
 * A Zone object allows you to interact with a Google Compute Engine zone.
 *
 * @constructor
 * @alias module:compute/zone
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
 */
function Zone(compute, name) {
  this.compute = compute;
  this.name = name;

  this.gceImages = gceImages(compute.authConfig);
}

/**
 * Create a disk in this zone. For a detailed description of method's options
 * see [API reference](https://goo.gl/suU3qn).
 *
 * @param {string} name - Name of the disk.
 * @param {object} config - See a
 *     [Disk resource](https://goo.gl/cpflgm) for more information.
 * @param {function} callback - The callback function.
 *
 * @example
 * var config = {
 *   sizeGb: 10
 * };
 *
 * zone.createDisk('name', config, function(err, disk, operation, apiResponse) {
 *   // `disk` is a Disk object.
 *
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * });
 */
Zone.prototype.createDisk = function(name, config, callback) {
  var self = this;

  var query = {};
  var body = extend({}, config, {
    name: name
  });

  if (body.image) {
    query.sourceImage = body.image;
    delete body.image;
  }

  this.makeReq_('POST', '/disks', query, body, function(err, resp) {
    if (err) {
      callback(err, null, null, resp);
      return;
    }

    var disk = self.disk(name);

    var operation = self.operation(resp.name);
    operation.metadata = resp;

    callback(null, disk, operation, resp);
  });
};

/**
 * Create a virtual machine in the zone. For a detailed description of method's
 * options see [API reference](https://goo.gl/oWcGvQ).
 *
 * @param {string} name - Name of the instance.
 * @param {object} config - See an
 *     [Instance resource](https://goo.gl/fuLRMj) for more information.
 * @param {object[]=} config.disks - See a
 *     [Disk resource](https://goo.gl/cpflgm) for more information.
 * @param {string=} config.machineType - The machine type resource to use.
 *     Provide only the name of the machine, e.g. `n1-standard-16`. Refer to
 *     [Available Machine Types](https://goo.gl/jrHEbo). Default:
 *     `n1-standard-1`
 * @param {boolean=} config.http - Allow HTTP traffic. Default: `false`
 * @param {boolean=} config.https - Allow HTTPS traffic. Default: `false`
 * @param {object[]=} config.networkInterfaces - An array of configurations for
 *     this interface. This specifies how this interface should interact with
 *     other network services, such as connecting to the internet. Default:
 *     `[ { network: 'global/networks/default' } ]`
 * @param {string=} config.os - Specify the name of an OS, and we will use the
 *     latest version as the source image of a new boot disk. See
 *     [this list of accepted OS names](https://goo.gl/6OGx9z).
 * @param {function} callback - The callback function.
 *
 * @example
 * //-
 * // Create a new instance using the latest Debian version as the source image
 * // for a new boot disk.
 * //-
 * var config = {
 *   os: 'debian',
 *   http: true
 * };
 *
 * //-
 * // The above object will auto-expand behind the scenes to something like the
 * // following. The Debian version may be different when you run the command.
 * //-
 * var config = {
 *   machineType: 'n1-standard-1',
 *   disks: [
 *     {
 *       boot: true,
 *       initializeParams: {
 *         sourceImage:
 *           'https://www.googleapis.com/compute/v1/projects' +
 *           '/debian-cloud/global/images/debian-7-wheezy-v20150710'
 *       }
 *     }
 *   ],
 *   networkInterfaces: [
 *     {
 *       network: 'global/networks/default'
 *     }
 *   ],
 *   tags: [
 *     {
 *       items: [
 *         'http-server'
 *       ]
 *     }
 *   ]
 * };
 *
 * function callback(err, instance, operation, apiResponse) {
 *   // `instance` is an Instance object.
 *
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * }
 *
 * zone.createVM('new-vm-name', config, callback);
 */
Zone.prototype.createVM = function(name, config, callback) {
  var self = this;

  var body = extend({
    name: name,
    machineType: 'n1-standard-1',
    networkInterfaces: [
      {
        network: 'global/networks/default'
      }
    ]
  }, config);

  if (body.machineType.indexOf('/') === -1) {
    // The specified machineType is only a partial name, e.g. 'n1-standard-1'.
    body.machineType = format('zones/{zoneName}/machineTypes/{machineType}', {
      zoneName: this.name,
      machineType: body.machineType
    });
  }

  if (config.http || config.https) {
    body.networkInterfaces[0].accessConfigs = [
      {
        type: 'ONE_TO_ONE_NAT'
      }
    ];

    body.tags = body.tags || {};
    body.tags.items = body.tags.items || [];

    if (config.http) {
      if (body.tags.items.indexOf('http-server') === -1) {
        body.tags.items.push('http-server');
      }
    }
    if (config.https) {
      if (body.tags.items.indexOf('https-server') === -1) {
        body.tags.items.push('https-server');
      }
    }
  }

  if (body.os) {
    this.gceImages.getLatest(body.os, function(err, image) {
      if (err) {
        callback(err);
        return;
      }

      delete body.os;
      body.disks = body.disks || [];
      body.disks.push({
        boot: true,
        initializeParams: {
          sourceImage: image.selfLink
        }
      });

      self.createVM(name, body, callback);
    });
    return;
  }

  this.makeReq_('POST', '/instances', null, body, function(err, resp) {
    if (err) {
      callback(err, null, null, resp);
      return;
    }

    var vm = self.vm(name);

    var operation = self.operation(resp.name);
    operation.metadata = resp;

    callback(null, vm, operation, resp);
  });
};

/**
 * Get a reference to a Google Compute Engine disk in this zone.
 *
 * @param {string} name - Name of the existing disk.
 * @return {module:compute/disk}
 *
 * @example
 * var disk = zone.disk('disk1');
 */
Zone.prototype.disk = function(name) {
  return new Disk(this, name);
};

/**
 * Get a list of disks in this zone. For a detailed description of method's
 * options see [API reference](https://goo.gl/0R67mp).
 *
 * @param {object=} options - Disk search options.
 * @param {boolean} options.autoPaginate - Have pagination handled
 *     automatically. Default: true.
 * @param {string} options.filter - Search filter in the format of
  *     `{name} {comparison} {filterString}`.
  *     - **`name`**: the name of the field to compare
  *     - **`comparison`**: the comparison operator, `eq` (equal) or `ne`
  *       (not equal)
  *     - **`filterString`**: the string to filter to. For string fields, this
  *       can be a regular expression.
 * @param {number} options.maxResults - Maximum number of disks to return.
 * @param {string} options.pageToken - A previously-returned page token
 *     representing part of the larger set of results to view.
 * @param {function} callback - The callback function.
 *
 * @example
 * zone.getDisks(function(err, disks) {
 *   // `disks` is an array of `Disk` objects.
 * });
 *
 * //-
 * // To control how many API requests are made and page through the results
 * // manually, set `autoPaginate` to `false`.
 * //-
 * function callback(err, disks, nextQuery, apiResponse) {
 *   if (nextQuery) {
 *     // More results exist.
 *     zone.getDisks(nextQuery, callback);
 *   }
 * }
 *
 * zone.getDisks({
 *   autoPaginate: false
 * }, callback);
 *
 * //-
 * // Get the disks from your project as a readable object stream.
 * //-
 * zone.getDisks()
 *   .on('error', console.error)
 *   .on('data', function(disk) {
 *     // `disk` is a `Disk` object.
 *   })
 *   .on('end', function() {
 *     // All disks retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * zone.getDisks()
 *   .on('data', function(disk) {
 *     this.end();
 *   });
 */
Zone.prototype.getDisks = function(options, callback) {
  var self = this;

  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  options = options || {};

  this.makeReq_('GET', '/disks', options, null, function(err, resp) {
    if (err) {
      callback(err, null, null, resp);
      return;
    }

    var nextQuery = null;

    if (resp.nextPageToken) {
      nextQuery = extend({}, options, {
        pageToken: resp.nextPageToken
      });
    }

    var disks = (resp.items || []).map(function(disk) {
      var diskInstance = self.disk(disk.name);
      diskInstance.metadata = disk;
      return diskInstance;
    });

    callback(null, disks, nextQuery, resp);
  });
};

/**
 * Get a list of VM instances in this zone. For a detailed description of
 * method's options see [API reference](https://goo.gl/80ya6l).
 *
 * @param {object=} options - Instance search options.
 * @param {boolean} options.autoPaginate - Have pagination handled
 *     automatically. Default: true.
 * @param {string} options.filter - Search filter in the format of
 *     `{name} {comparison} {filterString}`.
 *     - **`name`**: the name of the field to compare
 *     - **`comparison`**: the comparison operator, `eq` (equal) or `ne`
 *       (not equal)
 *     - **`filterString`**: the string to filter to. For string fields, this
 *       can be a regular expression.
 * @param {string} options.pageToken - A previously-returned page token
 *     representing part of the larger set of results to view.
 * @param {function} callback - The callback function.
 *
 * @example
 * zone.getVMs(function(err, vms) {
 *   // `vms` is an array of `VM` objects.
 * });
 *
 * //-
 * // To control how many API requests are made and page through the results
 * // manually, set `autoPaginate` to `false`.
 * //-
 * function callback(err, vms, nextQuery, apiResponse) {
 *   if (nextQuery) {
 *     // More results exist.
 *     zone.getVMs(nextQuery, callback);
 *   }
 * }
 *
 * zone.getVMs({
 *   autoPaginate: false
 * }, callback);
 *
 * //-
 * // Get the VM instances from your project as a readable object stream.
 * //-
 * zone.getVMs()
 *   .on('error', console.error)
 *   .on('data', function(vm) {
 *     // `vm` is a `VM` object.
 *   })
 *   .on('end', function() {
 *     // All instances retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * zone.getVMs()
 *   .on('data', function(vm) {
 *     this.end();
 *   });
 */
Zone.prototype.getVMs = function(options, callback) {
  var self = this;

  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  options = options || {};

  this.makeReq_('GET', '/instances', options, null, function(err, resp) {
    if (err) {
      callback(err, null, null, resp);
      return;
    }

    var nextQuery = null;

    if (resp.nextPageToken) {
      nextQuery = extend({}, options, {
        pageToken: resp.nextPageToken
      });
    }

    var vms = (resp.items || []).map(function(instance) {
      var vmInstance = self.vm(instance.name);
      vmInstance.metadata = instance;
      return vmInstance;
    });

    callback(null, vms, nextQuery, resp);
  });
};

/**
 * Get a list of operations for this zone. For a detailed description of
 * method's options see [API reference](https://goo.gl/5n74cP).
 *
 * @param {object=} options - Operation search options.
 * @param {boolean} options.autoPaginate - Have pagination handled
 *     automatically. Default: true.
 * @param {string} options.filter - Search filter in the format of
 *     `{name} {comparison} {filterString}`.
 *     - **`name`**: the name of the field to compare
 *     - **`comparison`**: the comparison operator, `eq` (equal) or `ne`
 *       (not equal)
 *     - **`filterString`**: the string to filter to. For string fields, this
 *       can be a regular expression.
 * @param {number} options.maxResults - Maximum number of operations to return.
 * @param {string} options.pageToken - A previously-returned page token
 *     representing part of the larger set of results to view.
 * @param {function} callback - The callback function.
 *
 * @example
 * zone.getOperations(function(err, operations) {
 *   // `operations` is an array of `Operation` objects.
 * });
 *
 * //-
 * // To control how many API requests are made and page through the results
 * // manually, set `autoPaginate` to `false`.
 * //-
 * function callback(err, operations, nextQuery, apiResponse) {
 *   if (nextQuery) {
 *     // More results exist.
 *     zone.getOperations(nextQuery, callback);
 *   }
 * }
 *
 * zone.getOperations({
 *   autoPaginate: false
 * }, callback);
 *
 * //-
 * // Get the operations from your project as a readable object stream.
 * //-
 * zone.getOperations()
 *   .on('error', console.error)
 *   .on('data', function(operation) {
 *     // `operation` is an `Operation` object.
 *   })
 *   .on('end', function() {
 *     // All operations retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * zone.getOperations()
 *   .on('data', function(operation) {
 *     this.end();
 *   });
 */
Zone.prototype.getOperations = function(options, callback) {
  var self = this;

  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  options = options || {};

  this.makeReq_('GET', '/operations', options, null, function(err, resp) {
    if (err) {
      callback(err, null, null, resp);
      return;
    }

    var nextQuery = null;

    if (resp.nextPageToken) {
      nextQuery = extend({}, options, {
        pageToken: resp.nextPageToken
      });
    }

    var operations = (resp.items || []).map(function(operation) {
      var operationInstance = self.operation(operation.name);
      operationInstance.metadata = operation;
      return operationInstance;
    });

    callback(null, operations, nextQuery, resp);
  });
};

/**
 * Get a reference to a Google Compute Engine zone operation.
 *
 * @param {string} name - Name of the existing operation.
 * @return {module:compute/operation}
 *
 * @example
 * var operation = zone.operation('operation-name');
 */
Zone.prototype.operation = function(name) {
  return new Operation(this, name);
};

/**
 * Get a reference to a Google Compute Engine virtual machine instance.
 *
 * @param {string} name - Name of the existing virtual machine.
 * @return {module:compute/vm}
 *
 * @example
 * var vm = zone.vm('vm-name');
 */
Zone.prototype.vm = function(name) {
  return new VM(this.compute, this, name);
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
Zone.prototype.makeReq_ = function(method, path, query, body, callback) {
  path = '/zones/' + this.name + path;
  this.compute.makeReq_(method, path, query, body, callback);
};

/*! Developer Documentation
 *
 * These methods can be used with either a callback or as a readable object
 * stream. `streamRouter` is used to add this dual behavior.
 */
streamRouter.extend(Zone, ['getDisks', 'getOperations', 'getVMs']);

module.exports = Zone;
