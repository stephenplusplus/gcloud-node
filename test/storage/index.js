/**
 * Copyright 2014 Google Inc. All Rights Reserved.
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

var arrify = require('arrify');
var assert = require('assert');
var extend = require('extend');
var mockery = require('mockery');
var nodeutil = require('util');

var Service = require('../../lib/common/service.js');
var util = require('../../lib/common/util.js');

var fakeUtil = extend({}, util);

var extended = false;
var fakeStreamRouter = {
  extend: function(Class, methods) {
    if (Class.name !== 'Storage') {
      return;
    }

    methods = arrify(methods);
    assert.equal(Class.name, 'Storage');
    assert.deepEqual(methods, ['getBuckets']);
    extended = true;
  }
};

function FakeService() {
  this.calledWith_ = arguments;
  Service.apply(this, arguments);
}

nodeutil.inherits(FakeService, Service);

describe('Storage', function() {
  var PROJECT_ID = 'project-id';
  var Storage;
  var storage;
  var Bucket;

  before(function() {
    mockery.registerMock('../common/service.js', FakeService);
    mockery.registerMock('../common/util.js', fakeUtil);
    mockery.registerMock('../common/stream-router.js', fakeStreamRouter);

    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false
    });

    Bucket = require('../../lib/storage/bucket.js');
    Storage = require('../../lib/storage');
  });

  after(function() {
    mockery.deregisterAll();
    mockery.disable();
  });

  beforeEach(function() {
    storage = new Storage({ projectId: PROJECT_ID });
  });

  describe('instantiation', function() {
    it('should extend the correct methods', function() {
      assert(extended); // See `fakeStreamRouter.extend`
    });

    it('should normalize the arguments', function() {
      var normalizeArguments = fakeUtil.normalizeArguments;
      var normalizeArgumentsCalled = false;
      var fakeOptions = { projectId: PROJECT_ID };
      var fakeContext = {};

      fakeUtil.normalizeArguments = function(context, options) {
        normalizeArgumentsCalled = true;
        assert.strictEqual(context, fakeContext);
        assert.strictEqual(options, fakeOptions);
        return options;
      };

      Storage.call(fakeContext, fakeOptions);
      assert(normalizeArgumentsCalled);

      fakeUtil.normalizeArguments = normalizeArguments;
    });

    it('should inherit from Service', function() {
      assert(storage instanceof Service);

      var calledWith = storage.calledWith_[0];

      var baseUrl = 'https://www.googleapis.com/storage/v1';
      assert.strictEqual(calledWith.baseUrl, baseUrl);
      assert.strictEqual(calledWith.projectIdRequired, false);
      assert.deepEqual(calledWith.scopes, [
        'https://www.googleapis.com/auth/devstorage.full_control'
      ]);
    });
  });

  describe('bucket', function() {
    it('should throw if no name was provided', function() {
      assert.throws(function() {
        storage.bucket();
      }, /A bucket name is needed/);
    });

    it('should accept a string for a name', function() {
      var newBucketName = 'new-bucket-name';
      var bucket = storage.bucket(newBucketName);
      assert(bucket instanceof Bucket);
      assert.equal(bucket.name, newBucketName);
    });
  });

  describe('createBucket', function() {
    var BUCKET_NAME = 'new-bucket-name';
    var METADATA = { a: 'b', c: { d: 'e' } };
    var BUCKET = { name: BUCKET_NAME };

    it('should make correct API request', function(done) {
      storage.request = function(reqOpts, callback) {
        assert.strictEqual(reqOpts.method, 'POST');
        assert.strictEqual(reqOpts.uri, '/b');
        assert.strictEqual(reqOpts.qs.project, storage.projectId);
        assert.strictEqual(reqOpts.json.name, BUCKET_NAME);

        callback();
      };

      storage.createBucket(BUCKET_NAME, done);
    });

    it('should accept a name, metadata, and callback', function(done) {
      storage.request = function(reqOpts, callback) {
        assert.deepEqual(reqOpts.json, extend(METADATA, { name: BUCKET_NAME }));
        callback(null, METADATA);
      };
      storage.bucket = function(name) {
        assert.equal(name, BUCKET_NAME);
        return BUCKET;
      };
      storage.createBucket(BUCKET_NAME, METADATA, function(err) {
        assert.ifError(err);
        done();
      });
    });

    it('should accept a name and callback only', function(done) {
      storage.request = function(reqOpts, callback) {
        callback();
      };
      storage.createBucket(BUCKET_NAME, done);
    });

    it('should throw if no name is provided', function() {
      assert.throws(function() {
        storage.createBucket();
      }, /A name is required/);
    });

    it('should execute callback with bucket', function(done) {
      storage.bucket = function() {
        return BUCKET;
      };
      storage.request = function(reqOpts, callback) {
        callback(null, METADATA);
      };
      storage.createBucket(BUCKET_NAME, function(err, bucket) {
        assert.ifError(err);
        assert.deepEqual(bucket, BUCKET);
        assert.deepEqual(bucket.metadata, METADATA);
        done();
      });
    });

    it('should execute callback on error', function(done) {
      var error = new Error('Error.');
      storage.request = function(reqOpts, callback) {
        callback(error);
      };
      storage.createBucket(BUCKET_NAME, function(err) {
        assert.equal(err, error);
        done();
      });
    });

    it('should execute callback with apiResponse', function(done) {
      var resp = { success: true };
      storage.request = function(reqOpts, callback) {
        callback(null, resp);
      };
      storage.createBucket(BUCKET_NAME, function(err, bucket, apiResponse) {
        assert.equal(resp, apiResponse);
        done();
      });
    });

    it('should expand the Nearline option', function(done) {
      storage.request = function(reqOpts) {
        assert.strictEqual(reqOpts.json.storageClass, 'NEARLINE');
        done();
      };
      storage.createBucket(BUCKET_NAME, { nearline: true }, function() {});
    });

    it('should expand the Durable Reduced Availability option', function(done) {
      storage.request = function(reqOpts) {
        var body = reqOpts.json;
        assert.strictEqual(body.storageClass, 'DURABLE_REDUCED_AVAILABILITY');
        done();
      };
      storage.createBucket(BUCKET_NAME, { dra: true }, function() {});
    });
  });

  describe('getBuckets', function() {
    it('should get buckets without a query', function(done) {
      storage.request = function(reqOpts) {
        assert.strictEqual(reqOpts.uri, '/b');
        assert.deepEqual(reqOpts.qs, { project: storage.projectId });
        done();
      };
      storage.getBuckets(util.noop);
    });

    it('should get buckets with a query', function(done) {
      var token = 'next-page-token';
      storage.request = function(reqOpts) {
        assert.deepEqual(reqOpts.qs, {
          project: storage.projectId,
          maxResults: 5,
          pageToken: token
        });
        done();
      };
      storage.getBuckets({ maxResults: 5, pageToken: token }, util.noop);
    });

    it('should return nextQuery if more results exist', function() {
      var token = 'next-page-token';
      storage.request = function(reqOpts, callback) {
        callback(null, { nextPageToken: token, items: [] });
      };
      storage.getBuckets({ maxResults: 5 }, function(err, results, nextQuery) {
        assert.equal(nextQuery.pageToken, token);
        assert.strictEqual(nextQuery.maxResults, 5);
      });
    });

    it('should return null nextQuery if there are no more results', function() {
      storage.request = function(reqOpts, callback) {
        callback(null, { items: [] });
      };
      storage.getBuckets({ maxResults: 5 }, function(err, results, nextQuery) {
        assert.strictEqual(nextQuery, null);
      });
    });

    it('should return Bucket objects', function(done) {
      storage.request = function(reqOpts, callback) {
        callback(null, { items: [{ id: 'fake-bucket-name' }] });
      };
      storage.getBuckets(function(err, buckets) {
        assert.ifError(err);
        assert(buckets[0] instanceof Bucket);
        done();
      });
    });

    it('should return apiResponse', function(done) {
      var resp = { items: [{ id: 'fake-bucket-name' }] };
      storage.request = function(reqOpts, callback) {
        callback(null, resp);
      };
      storage.getBuckets(function(err, buckets, nextQuery, apiResponse) {
        assert.deepEqual(resp, apiResponse);
        done();
      });
    });

    it('should populate returned Bucket object with metadata', function(done) {
      var bucketMetadata = {
        id: 'bucketname',
        contentType: 'x-zebra',
        metadata: {
          my: 'custom metadata'
        }
      };
      storage.request = function(reqOpts, callback) {
        callback(null, { items: [bucketMetadata] });
      };
      storage.getBuckets(function(err, buckets) {
        assert.ifError(err);
        assert.deepEqual(buckets[0].metadata, bucketMetadata);
        done();
      });
    });
  });
});
