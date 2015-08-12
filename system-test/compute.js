'use strict';

var assert = require('assert');
var async = require('async');

var env = require('./env.js');
var Compute = require('../lib/compute/index.js');

var compute = new Compute(env);

var INSTANCE_NAME_PREFIX = 'gcloud-tests-instance-';

function generateInstanceName() {
  return INSTANCE_NAME_PREFIX + Date.now();
}

function deleteAllTestInstances(callback) {
  compute.getInstances({
    filter: 'name eq .*' + INSTANCE_NAME_PREFIX + '.*'
  }, function(err, instances) {
    if (err) {
      callback(err);
      return;
    }

    async.each(instances, function(instance, next) {
      instance.delete(function(err, operation) {
        if (err) {
          next(err);
          return;
        }

        operation.onComplete(next);
      });
    }, callback);
  });
}

describe('Compute', function() {
  describe('instances', function() {
    it('should get a list of instances', function(done) {
      compute.getInstances(function(err, instances) {
        assert.ifError(err);
        assert(instances.length > 0);
        done();
      });
    });
  });

  describe('zones', function() {
    var ZONE_NAME = 'us-central1-a';
    var zone = compute.zone(ZONE_NAME);

    describe('instances', function() {
      after(function(done) {
        this.timeout(60000);
        deleteAllTestInstances(done);
      });

      it('should create an instance', function(done) {
        var name = generateInstanceName();

        var config = {
          os: 'ubuntu'
        };

        zone.createInstance(name, config, function(err, instance, operation) {
          assert.ifError(err);

          assert.strictEqual(instance.name, name);

          operation.onComplete(function(err) {
            assert.ifError(err);
            instance.delete(done);
          });
        });
      });
    });
  });
});
