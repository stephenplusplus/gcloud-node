/**
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

'use strict';

var assert = require('assert');
var mockery = require('mockery-next');
var nodeutil = require('util');

var ServiceObject = require('../../lib/common/service-object.js');

function FakeServiceObject() {
  this.calledWith_ = arguments;
  ServiceObject.apply(this, arguments);
}

nodeutil.inherits(FakeServiceObject, ServiceObject);

describe('Service', function() {
  var Service;
  var service;

  before(function() {
    mockery.registerMock(
      '../../lib/common/service-object.js',
      FakeServiceObject
    );
    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false
    });

    Service = require('../../lib/compute/service.js');
  });

  after(function() {
    mockery.deregisterAll();
    mockery.disable();
  });

  beforeEach(function() {
    service = new Service();
  });

  describe('instantiation', function() {
    it('should inherit from ServiceObject', function() {
      var service = new Service();
      assert(service instanceof Service);
    });
  });

  describe('aMethod', function() {
    it('should ...', function() {
    });
  });
});
