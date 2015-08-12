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
 * @module compute
 */

'use strict';

var extend = require('extend');
var is = require('is');

/**
 * @type {module:compute/firewall}
 * @private
 */
var Firewall = require('./firewall.js');

/**
 * @type {module:compute/network}
 * @private
 */
var Network = require('./network.js');

/**
 * @type {module:compute/operation}
 * @private
 */
var Operation = require('./operation.js');

/**
 * @type {module:compute/region}
 * @private
 */
var Region = require('./region.js');

/**
 * @type {module:compute/snapshot}
 * @private
 */
var Snapshot = require('./snapshot.js');

/**
 * @type {module:common/streamrouter}
 * @private
 */
var streamRouter = require('../common/stream-router.js');

/**
 * @type {module:common/util}
 * @private
 */
var util = require('../common/util.js');

/**
 * @type {module:compute/zone}
 * @private
 */
var Zone = require('./zone.js');

/**
 * @const {string}
 * @private
 */
var COMPUTE_BASE_URL = 'https://www.googleapis.com/compute/v1/projects/';

/**
 * Required scopes for Google Compute Engine API.
 * @const {array}
 * @private
 */
var SCOPES = ['https://www.googleapis.com/auth/compute'];

/**
 * A Compute object allows you to interact with the Google Compute Engine API.
 * Using this object, you can access your instances with
 * {module:compute/instance}, disks with {module:compute/disk}, and firewalls
 * with {module:compute/firewall}.
 *
 * @alias module:compute
 * @constructor
 *
 * @param {object} options - [Configuration object](#/docs/?method=gcloud).
 *
 * @example
 * var gcloud = require('gcloud')({
 *   keyFilename: '/path/to/keyfile.json',
 *   projectId: 'grape-spaceship-123'
 * });
 *
 * var compute = gcloud.compute();
 */
function Compute(options) {
  if (!(this instanceof Compute)) {
    return new Compute(options);
  }

  options = options || {};

  if (!options.projectId) {
    throw util.missingProjectIdError;
  }

  var authConfig = {
    credentials: options.credentials,
    keyFile: options.keyFilename,
    scopes: SCOPES,
    email: options.email
  };

  this.authConfig = authConfig;

  this.makeAuthorizedRequest_ = util.makeAuthorizedRequestFactory(authConfig);

  this.projectId = options.projectId;
}

/**
 * Create a firewall. For a detailed description of method's options see
 * [API reference](https://goo.gl/kTMHep).
 *
 * @param {string} name - Name of the firewall.
 * @param {object} config - Configuration object. See a
 *     [Firewall resource](https://goo.gl/7FpjXA) for detailed information.
 * @param {function} callback - The callback function.
 *
 * @example
 * var config = {
 *   allowed: [
 *     {
 *       IPProtocol: 'tcp',
 *       ports: ['3000']
 *     }
 *   ],
 *   sourceRanges: ['0.0.0.0/0']
 * };
 *
 * function callback(err, firewall, operation, apiResponse) {
 *   // `firewall` is a Firewall object.
 *
 *   // `operation` is an Operation object that can be used to check the status
 *   // of the request.
 * }
 *
 * compute.createFirewall('new-firewall-name', config, callback);
 */
Compute.prototype.createFirewall = function(name, config, callback) {
  var self = this;

  config = config || {};
  config.name = name;

  var path = '/global/firewalls';

  this.makeReq_('POST', path, null, config, function(err, resp) {
    if (err) {
      callback(err, null, null, resp);
      return;
    }

    var firewall = self.firewall(name);

    var operation = self.operation(resp.name);
    operation.metadata = resp;

    callback(null, firewall, operation, resp);
  });
};

/**
 * Create a network. For a detailed description of method's options see
 * [API reference](https://goo.gl/cWYdER).
 *
 * @param {string} name - Name of the network.
 * @param {object} config - Configuration object. See a
 *     [Network resource](https://goo.gl/J99xH3) for detailed information.
 * @param {string} config.range - CIDR range of addresses that are legal on
 *     this network. (Alias for `config.IPv4Range`)
 * @param {function} callback - The callback function.
 *
 * @example
 * var config = {
 *   range: '192.168.0.0/16'
 * };
 *
 * function callback(err, network, operation, apiResponse) {
 *   // `network` is a Network object.
 *
 *   // `operation` is an Operation object and can be used to check the status
 *   // of network creation.
 * }
 *
 * compute.createNetwork('new-network', config, callback);
 */
Compute.prototype.createNetwork = function(name, config, callback) {
  var self = this;

  config = config || {};
  config.name = name;

  if (config.range) {
    config.IPv4Range = config.range;
    delete config.range;
  }

  this.makeReq_('POST', '/global/networks', null, config, function(err, resp) {
    if (err) {
      callback(err, null, null, resp);
      return;
    }

    var network = self.network(name);

    var operation = self.operation(resp.name);
    operation.metadata = resp;

    callback(null, network, operation, resp);
  });
};

/**
 * Get a reference to a Google Compute Engine firewall.
 *
 * See {module:compute/network#firewall} to get a Firewall object for a specific
 * network.
 *
 * @param {string} name - Name of the existing firewall.
 * @param {string=} network - Network name for the existing firewall.
 * @return {module:compute/firewall}
 *
 * @example
 * var firewall = compute.firewall('existing-firewall');
 */
Compute.prototype.firewall = function(name) {
  return new Firewall(this, name);
};

/**
 * Get a list of addresses. For a detailed description of method's options see
 * [API reference](https://goo.gl/r9XmXJ).
 *
 * @param {object=} options - Address search options.
 * @param {boolean} options.autoPaginate - Have pagination handled
 *     automatically. Default: true.
 * @param {string} options.filter - Search filter in the format of
 *     `{name} {comparison} {filterString}`.
 *     - **`name`**: the name of the field to compare
 *     - **`comparison`**: the comparison operator, `eq` (equal) or `ne`
 *       (not equal)
 *     - **`filterString`**: the string to filter to. For string fields, this
 *       can be a regular expression.
 * @param {number} options.maxResults - Maximum number of addresses to return.
 * @param {string} options.pageToken - A previously-returned page token
 *     representing part of the larger set of results to view.
 * @param {function} callback - The callback function.
 *
 * @example
 * compute.getAddresses(function(err, addresses) {
 *   // addresses is an array of `Address` objects.
 * });
 *
 * //-
 * // To control how many API requests are made and page through the results
 * // manually, set `autoPaginate` to `false`.
 * //-
 * function callback(err, addresses, nextQuery, apiResponse) {
 *   if (nextQuery) {
 *     // More results exist.
 *     compute.getAddresses(nextQuery, callback);
 *   }
 * }
 *
 * compute.getAddresses({
 *   autoPaginate: false
 * }, callback);
 *
 * //-
 * // Get the addresses from your project as a readable object stream.
 * //-
 * compute.getAddresses()
 *   .on('error', console.error)
 *   .on('data', function(address) {
 *     // `address` is an `Address` object.
 *   })
 *   .on('end', function() {
 *     // All addresses retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * compute.getAddresses()
 *   .on('data', function(address) {
 *     this.end();
 *   });
 */
Compute.prototype.getAddresses = function(options, callback) {
  var self = this;

  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  options = options || {};

  var path = '/aggregated/addresses';

  this.makeReq_('GET', path, options, null, function(err, resp) {
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

    var regions = resp.items || {};

    var addresses = Object.keys(regions).reduce(function(acc, regionName) {
      regionName = regionName.replace('regions/', '');

      var region = self.region(regionName);
      var regionAddresses = regions[regionName].addresses || [];

      regionAddresses.forEach(function(address) {
        var addressInstance = region.address(address.name);
        addressInstance.metadata = address;
        acc.push(addressInstance);
      });

      return acc;
    }, []);

    callback(null, addresses, nextQuery, resp);
  });
};

/**
 * Get a list of disks. For a detailed description of method's options see
 * [API reference](https://goo.gl/M9Qjb3).
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
 * compute.getDisks(function(err, disks) {
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
 *     compute.getDisks(nextQuery, callback);
 *   }
 * }
 *
 * compute.getDisks({
 *   autoPaginate: false
 * }, callback);
 *
 * //-
 * // Get the disks from your project as a readable object stream.
 * //-
 * compute.getDisks()
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
 * compute.getDisks()
 *   .on('data', function(disk) {
 *     this.end();
 *   });
 */
Compute.prototype.getDisks = function(options, callback) {
  var self = this;

  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  options = options || {};

  this.makeReq_('GET', '/aggregated/disks', options, null, function(err, resp) {
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

    var zones = resp.items || {};

    var disks = Object.keys(zones).reduce(function(acc, zoneName) {
      zoneName = zoneName.replace('zones/', '');

      var zone = self.zone(zoneName);
      var disks = zones[zoneName].disks || [];

      disks.forEach(function(disk) {
        var diskInstance = zone.disk(disk.name);
        diskInstance.metadata = disk;
        acc.push(diskInstance);
      });

      return acc;
    });

    callback(null, disks, nextQuery, resp);
  });
};

/**
 * Get a list of firewall rules. For a detailed description of method's options
 * see [API reference](https://goo.gl/TZRxht).
 *
 * @param {object=} options - Firewall search options.
 * @param {boolean} options.autoPaginate - Have pagination handled
 *     automatically. Default: true.
 * @param {string} options.filter - Search filter in the format of
 *     `{name} {comparison} {filterString}`.
 *     - **`name`**: the name of the field to compare
 *     - **`comparison`**: the comparison operator, `eq` (equal) or `ne`
 *       (not equal)
 *     - **`filterString`**: the string to filter to. For string fields, this
 *       can be a regular expression.
 * @param {number} options.maxResults - Maximum number of firewalls to return.
 * @param {string} options.pageToken - A previously-returned page token
 *     representing part of the larger set of results to view.
 * @param {function} callback - The callback function.
 *
 * @example
 * compute.getFirewalls(function(err, firewalls) {
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
 *     compute.getFirewalls(nextQuery, callback);
 *   }
 * }
 *
 * compute.getFirewalls({
 *   autoPaginate: false
 * }, callback);
 *
 * //-
 * // Get the firewalls from your project as a readable object stream.
 * //-
 * compute.getFirewalls()
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
 * compute.getFirewalls()
 *   .on('data', function(firewall) {
 *     this.end();
 *   });
 */
Compute.prototype.getFirewalls = function(options, callback) {
  var self = this;

  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  options = options || {};

  this.makeReq_('GET', '/global/firewalls', options, null, function(err, resp) {
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

    var firewalls = (resp.items || []).map(function(firewall) {
      var firewallInstance = self.firewall(firewall.name);
      firewallInstance.metadata = firewall;
      return firewallInstance;
    });

    callback(null, firewalls, nextQuery, resp);
  });
};

/**
 * Get a list of instances. For a detailed description of method's options see
 * [API reference](https://goo.gl/GeDAwy).
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
 * @param {number} options.maxResults - Maximum number of instances to return.
 * @param {string} options.pageToken - A previously-returned page token
 *     representing part of the larger set of results to view.
 * @param {function} callback - The callback function.
 *
 * @example
 * compute.getInstances(function(err, instances) {
 *   // `instances` is an array of `Instance` objects.
 * });
 *
 * //-
 * // To control how many API requests are made and page through the results
 * // manually, set `autoPaginate` to `false`.
 * //-
 * function callback(err, instances, nextQuery, apiResponse) {
 *   if (nextQuery) {
 *     // More results exist.
 *     compute.getInstances(nextQuery, callback);
 *   }
 * }
 *
 * compute.getInstances({
 *   autoPaginate: false
 * }, callback);
 *
 * //-
 * // Get the instances from your project as a readable object stream.
 * //-
 * compute.getInstances()
 *   .on('error', console.error)
 *   .on('data', function(instance) {
 *     // `instance` is an `Instance` object.
 *   })
 *   .on('end', function() {
 *     // All instances retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * compute.getInstances()
 *   .on('data', function(instance) {
 *     this.end();
 *   });
 */
Compute.prototype.getInstances = function(options, callback) {
  var self = this;

  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  options = options || {};

  var path = '/aggregated/instances';

  this.makeReq_('GET', path, options, null, function(err, resp) {
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

    var zones = resp.items || {};

    var instances = Object.keys(zones).reduce(function(acc, zoneName) {
      var zone = self.zone(zoneName.replace('zones/', ''));
      var instances = zones[zoneName].instances || [];

      instances.forEach(function(instance) {
        var instanceInstance = zone.instance(instance.name);
        instanceInstance.metadata = instance;
        acc.push(instanceInstance);
      });

      return acc;
    }, []);

    callback(null, instances, nextQuery, resp);
  });
};

/**
 * Get a list of networks. For a detailed description of method's options
 * see [API reference](https://goo.gl/yx70Gc).
 *
 * @param {object=} options - Network search options.
 * @param {boolean} options.autoPaginate - Have pagination handled
 *     automatically. Default: true.
 * @param {string} options.filter - Search filter in the format of
 *     `{name} {comparison} {filterString}`.
 *     - **`name`**: the name of the field to compare
 *     - **`comparison`**: the comparison operator, `eq` (equal) or `ne`
 *       (not equal)
 *     - **`filterString`**: the string to filter to. For string fields, this
 *       can be a regular expression.
 * @param {number} options.maxResults - Maximum number of networks to return.
 * @param {string} options.pageToken - A previously-returned page token
 *     representing part of the larger set of results to view.
 * @param {function} callback - The callback function.
 *
 * @example
 * compute.getNetworks(function(err, networks) {
 *   // `networks` is an array of `Network` objects.
 * });
 *
 * //-
 * // To control how many API requests are made and page through the results
 * // manually, set `autoPaginate` to `false`.
 * //-
 * function callback(err, networks, nextQuery, apiResponse) {
 *   if (nextQuery) {
 *     // More results exist.
 *     compute.getNetworks(nextQuery, callback);
 *   }
 * }
 *
 * compute.getNetworks({
 *   autoPaginate: false
 * }, callback);
 *
 * //-
 * // Get the networks from your project as a readable object stream.
 * //-
 * compute.getNetworks()
 *   .on('error', console.error)
 *   .on('data', function(network) {
 *     // `network` is a `Network` object.
 *   })
 *   .on('end', function() {
 *     // All networks retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * compute.getNetworks()
 *   .on('data', function(network) {
 *     this.end();
 *   });
 */
Compute.prototype.getNetworks = function(options, callback) {
  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  options = options || {};

  var self = this;
  this.makeReq_('GET', '/global/networks', options, null, function(err, resp) {
    if (err) {
      callback(err);
      return;
    }

    var nextQuery = null;

    if (resp.nextPageToken) {
      nextQuery = extend({}, options, {
        pageToken: resp.nextPageToken
      });
    }

    var networks = (resp.items || []).map(function(network) {
      var networkInstance = self.network(network.name);
      networkInstance.metadata = network;
      return networkInstance;
    });

    callback(null, networks, nextQuery, resp);
  });
};

/**
 * Get a list of global operations. For a detailed description of method's
 * options see [API reference](https://goo.gl/gX4C1u).
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
 * compute.getOperations(function(err, operations) {
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
 *     compute.getOperations(nextQuery, callback);
 *   }
 * }
 *
 * compute.getOperations({
 *   autoPaginate: false
 * }, callback);
 *
 * //-
 * // Get the operations from your project as a readable object stream.
 * //-
 * compute.getOperations()
 *   .on('error', console.error)
 *   .on('data', function(operation) {
 *     // `operation` is a `Operation` object.
 *   })
 *   .on('end', function() {
 *     // All operations retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * compute.getOperations()
 *   .on('data', function(operation) {
 *     this.end();
 *   });
 */
Compute.prototype.getOperations = function(options, callback) {
  var self = this;

  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  options = options || {};

  var path = '/global/operations';

  this.makeReq_('GET', path, options, null, function(err, resp) {
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
 * Get a list of snapshots. For a detailed description of method's options see
 * [API reference](https://goo.gl/IEMVgi).
 *
 * @param {object=} options - Snapshot search options.
 * @param {boolean} options.autoPaginate - Have pagination handled
 *     automatically. Default: true.
 * @param {string} options.filter - Search filter in the format of
 *     `{name} {comparison} {filterString}`.
 *     - **`name`**: the name of the field to compare
 *     - **`comparison`**: the comparison operator, `eq` (equal) or `ne`
 *       (not equal)
 *     - **`filterString`**: the string to filter to. For string fields, this
 *       can be a regular expression.
 * @param {number} options.maxResults - Maximum number of snapshots to return.
 * @param {string} options.pageToken - A previously-returned page token
 *     representing part of the larger set of results to view.
 * @param {function} callback - The callback function.
 *
 * @example
 * compute.getSnapshots(function(err, snapshots) {
 *   // `snapshots` is an array of `Snapshot` objects.
 * });
 *
 * //-
 * // To control how many API requests are made and page through the results
 * // manually, set `autoPaginate` to `false`.
 * //-
 * function callback(err, snapshots, nextQuery, apiResponse) {
 *   if (nextQuery) {
 *     // More results exist.
 *     compute.getSnapshots(nextQuery, callback);
 *   }
 * }
 *
 * compute.getSnapshots({
 *   autoPaginate: false
 * }, callback);
 *
 * //-
 * // Get the snapshots from your project as a readable object stream.
 * //-
 * compute.getSnapshots()
 *   .on('error', console.error)
 *   .on('data', function(snapshot) {
 *     // `snapshot` is a `Snapshot` object.
 *   })
 *   .on('end', function() {
 *     // All snapshots retrieved.
 *   });
 *
 * //-
 * // If you anticipate many results, you can end a stream early to prevent
 * // unnecessary processing and API requests.
 * //-
 * compute.getSnapshots()
 *   .on('data', function(snapshot) {
 *     this.end();
 *   });
 */
Compute.prototype.getSnapshots = function(options, callback) {
  var self = this;

  if (is.fn(options)) {
    callback = options;
    options = {};
  }

  options = options || {};


  this.makeReq_('GET', '/global/snapshots', options, null, function(err, resp) {
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

    var snapshots = (resp.items || []).map(function(snapshot) {
      var snapshotInstance = self.snapshot(snapshot.name);
      snapshotInstance.metadata = snapshot;
      return snapshotInstance;
    });

    callback(null, snapshots, nextQuery, resp);
  });
};

/**
 * Get a reference to a Google Compute Engine network.
 *
 * @param {string} name - Name of the existing network.
 * @return {module:compute/network}
 *
 * @example
 * var network = compute.network('network-name');
 */
Compute.prototype.network = function(name) {
  return new Network(this, name);
};

/**
 * Get a reference to a Google Compute Engine operation.
 *
 * @param {string} name - Name of the existing operation.
 * @return {module:compute/operation}
 *
 * @example
 * var operation = compute.operation('operation-name');
 */
Compute.prototype.operation = function(name) {
  return new Operation(this, name);
};

/**
 * Get a reference to a Google Compute Engine region.
 *
 * @param {string} name - Name of the region.
 * @return {module:compute/region}
 *
 * @example
 * var region = compute.region('region-name');
 */
Compute.prototype.region = function(name) {
  return new Region(this, name);
};

/**
 * Get a reference to a Google Compute Engine snapshot.
 *
 * @param {string} name - Name of the existing snapshot.
 * @return {module:compute/snapshot}
 *
 * @example
 * var snapshot = compute.snapshot('snapshot-name');
 */
Compute.prototype.snapshot = function(name) {
  return new Snapshot(this, name);
};

/**
 * Get a reference to a Google Compute Engine zone.
 *
 * @param {string} name - Name of the zone.
 * @return {module:compute/zone}
 *
 * @example
 * var zone = compute.zone('zone-name');
 */
Compute.prototype.zone = function(name) {
  return new Zone(this, name);
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
Compute.prototype.makeReq_ = function(method, path, query, body, callback) {
  var reqOpts = {
    method: method,
    qs: query,
    uri: COMPUTE_BASE_URL + this.projectId + path
  };

  if (body) {
    reqOpts.json = body;
  }

  this.makeAuthorizedRequest_(reqOpts, callback);
};

/*! Developer Documentation
 *
 * These methods can be used with either a callback or as a readable object
 * stream. `streamRouter` is used to add this dual behavior.
 */
streamRouter.extend(Compute, [
  'getAddresses',
  'getDisks',
  'getFirewalls',
  'getImages',
  'getInstances',
  'getNetworks',
  'getOperations',
  'getSnapshots'
]);

module.exports = Compute;
