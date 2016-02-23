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

describe('Proxy', function() {
  var Proxy;
  var proxy;

  before(function() {
    mockery.registerMock(
      '../../lib/common/service-object.js',
      FakeServiceObject
    );
    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false
    });

    Proxy = require('../../lib/compute/proxy.js');
  });

  after(function() {
    mockery.deregisterAll();
    mockery.disable();
  });

  beforeEach(function() {
    proxy = new Proxy();
  });

  describe('instantiation', function() {
    it('should inherit from ServiceObject', function() {
      var proxy = new Proxy();
      assert(proxy instanceof Proxy);
    });
  });

  describe('aMethod', function() {
    it('should ...', function() {
    });
  });
});
