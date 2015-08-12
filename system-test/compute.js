'use strict';

var assert = require('assert');
var async = require('async');
var exec = require('methmeth');

var env = require('./env.js');
var Compute = require('../lib/compute/index.js');

var compute = new Compute(env);

var VM_NAME_PREFIX = 'gcloud-tests-instance-';

function generateVMName() {
  return VM_NAME_PREFIX + Date.now();
}

function deleteAllTestVMs(callback) {
  compute.getVMs({
    filter: 'name eq ' + VM_NAME_PREFIX + '.*'
  }, function(err, vms) {
    if (err) {
      callback(err);
      return;
    }

    async.each(vms, exec('delete'), callback);
  });
}

describe('Compute', function() {
  var ZONE_NAME = 'us-central1-a';
  var VM_NAME = generateVMName();

  var zone = compute.zone(ZONE_NAME);
  var vm;

  before(function(done) {
    this.timeout(60000);

    var config = {
      os: 'ubuntu',
      http: true,
      zone: zone
    };

    compute.createVM(VM_NAME, config, function(err, vm_, operation) {
      assert.ifError(err);
      vm = vm_;
      operation.onComplete(done);
    });
  });

  after(function(done) {
    deleteAllTestVMs(done);
  });

  describe('vms', function() {
    it('should get a list of vms', function(done) {
      compute.getVMs(function(err, vms) {
        assert.ifError(err);
        assert(vms.length > 0);
        done();
      });
    });

    it('should access a VM without providing a zone', function(done) {
      compute.vm(VM_NAME).getTags(function(err, tags) {
        assert.ifError(err);
        assert.deepEqual(tags, ['http-server']);
        done();
      });
    });
  });

  describe('zones', function() {
    describe('vms', function() {
      it('should get a list of vms', function(done) {
        zone.getVMs(function(err, vms) {
          assert.ifError(err);
          assert(vms.length > 0);
          done();
        });
      });

      it('should access a child VM', function(done) {
        zone.vm(VM_NAME).getTags(function(err, tags) {
          assert.ifError(err);
          assert.deepEqual(tags, ['http-server']);
          done();
        });
      });
    });
  });
});
