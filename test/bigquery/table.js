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

/*global describe, it, beforeEach */

'use strict';

var assert = require('assert');
var BigQuery = require('../../lib/bigquery');
var Dataset = require('../../lib/bigquery/dataset');
var Table = require('../../lib/bigquery/table');

describe('BigQuery/Table', function() {
  var DATASET_ID = 'kittens';
  var TABLE_ID = 'breeds';
  var bigQuery, ds, table;

  beforeEach(function() {
    bigQuery = new BigQuery();
    ds = new Dataset(bigQuery, DATASET_ID);
    table = new Table(ds, TABLE_ID);
  });

  describe('#delete', function() {
    it('should delete the table', function(done) {
      table.makeReq_ = function(method, path, query, body) {
        assert.equal(method, 'DELETE');
        assert.equal(path, '');
        assert.strictEqual(query, null);
        assert.strictEqual(body, null);
        done();
      };
      table.delete(assert.ifError);
    });

    it('should execute callback with error', function(done) {
      var error = new Error('Error.');
      table.makeReq_ = function(method, path, query, body, callback) {
        callback(error);
      };
      table.delete(function(err) {
        assert.equal(err, error);
        done();
      });
    });

    it('should execute callback with no error on success', function(done) {
      table.makeReq_ = function(method, path, query, body, callback) {
        callback();
      };
      table.delete(function(err) {
        assert.ifError(err);
        done();
      });
    });
  });

  describe('#getMetadata', function() {
    it('should get metadata from api', function(done) {
      table.makeReq_ = function(method, path, query, body) {
        assert.equal(method, 'GET');
        assert.equal(path, '');
        assert.strictEqual(query, null);
        assert.strictEqual(body, null);
        done();
      };
      table.getMetadata(assert.ifError);
    });

    it('should execute callback with error', function(done) {
      var error = new Error('Error.');
      table.makeReq_ = function(method, path, query, body, callback) {
        callback(error);
      };
      table.getMetadata(function(err) {
        assert.equal(err, error);
        done();
      });
    });

    describe('metadata', function() {
      var METADATA = { a: 'b', c: 'd' };

      beforeEach(function() {
        table.makeReq_ = function(method, path, query, body, callback) {
          callback(null, METADATA);
        };
      });

      it('should update metadata on Dataset object', function(done) {
        table.getMetadata(function(err) {
          assert.ifError(err);
          assert.deepEqual(table.metadata, METADATA);
          done();
        });
      });

      it('should execute callback with metadata', function(done) {
        table.getMetadata(function(err, metadata) {
          assert.ifError(err);
          assert.deepEqual(metadata, METADATA);
          done();
        });
      });
    });
  });
});
