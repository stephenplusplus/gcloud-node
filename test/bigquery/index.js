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
var Job = require('../../lib/bigquery/job');

describe('BigQuery', function() {
  var PROJECT_ID = 'test-project';
  var bq;

  beforeEach(function() {
    bq = new BigQuery({
      keyFilename: '/Users/stephen/dev/keyfile.json',
      projectId: 'nth-circlet-705'
    });
  });

  beforeEach(function() {
    return;
    bq = new BigQuery({ projectId: PROJECT_ID });
    bq.makeReq_ = function(method, path, query, body, callback) {
      callback();
    };
  });

  describe('createDataset', function() {
    var DATASET = 'kittens';

    it('should create a dataset', function(done) {
      bq.makeReq_ = function(method, path, query, body) {
        assert.equal(method, 'POST');
        assert.equal(path, '/datasets');
        assert.strictEqual(query, null);
        assert.deepEqual(body, {
          datasetReference: {
            datasetId: DATASET
          }
        });
        done();
      };
      bq.createDataset(DATASET, assert.ifError);
    });

    it('should return an error to the callback', function(done) {
      var error = new Error('Error.');
      bq.makeReq_ = function(method, path, query, body, callback) {
        callback(error);
      };
      bq.createDataset(DATASET, function(err) {
        assert.equal(err, error);
        done();
      });
    });

    it('should return a Dataset object', function(done) {
      bq.makeReq_ = function(method, path, query, body, callback) {
        callback(null, {});
      };
      bq.createDataset(DATASET, function(err, dataset) {
        assert.ifError(err);
        assert(dataset instanceof Dataset);
        done();
      });
    });

    it('should assign metadata to the Dataset object', function(done) {
      var metadata = { a: 'b', c: 'd' };
      bq.makeReq_ = function(method, path, query, body, callback) {
        callback(null, metadata);
      };
      bq.createDataset(DATASET, function(err, dataset) {
        assert.ifError(err);
        assert.deepEqual(dataset.metadata, metadata);
        done();
      });
    });
  });

  describe('createJob', function() {});

  describe('dataset', function() {});

  describe('getDatasets', function() {
    it('should get datasets from the api', function(done) {
      bq.makeReq_ = function(method, path, query, body) {
        assert.equal(method, 'GET');
        assert.equal(path, '/datasets');
        assert.deepEqual(query, {});
        assert.strictEqual(body, null);
        done();
      };
      bq.getDatasets(assert.ifError);
    });

    it('should accept query', function(done) {
      var queryObject = { all: true, maxResults: 8, pageToken: 'token' };
      bq.makeReq_ = function(method, path, query) {
        assert.deepEqual(query, queryObject);
        done();
      };
      bq.getDatasets(queryObject, assert.ifError);
    });

    it('should return error to callback', function(done) {
      var error = new Error('Error.');
      bq.makeReq_ = function(method, path, query, body, callback) {
        callback(error);
      };
      bq.getDatasets(function(err) {
        assert.equal(err, error);
        done();
      });
    });

    it('should return Dataset objects', function(done) {
      bq.makeReq_ = function(method, path, query, body, callback) {
        callback(null, {
          datasets: [{ datasetReference: { datasetId: 'datasetName' } }]
        });
      };
      bq.getDatasets(function(err, datasets) {
        assert.ifError(err);
        assert(datasets[0] instanceof Dataset);
        done();
      });
    });

    it('should assign metadata to the Dataset objects', function(done) {
      var datasetObjects = [
        {
          a: 'b',
          c: 'd',
          datasetReference: {
            datasetId: 'datasetName'
          }
        }
      ];
      bq.makeReq_ = function(method, path, query, body, callback) {
        callback(null, { datasets: datasetObjects });
      };
      bq.getDatasets(function(err, datasets) {
        assert.ifError(err);
        assert(datasets[0].metadata, datasetObjects[0]);
        done();
      });
    });

    it('should return token if more results exist', function(done) {
      var token = 'token';
      bq.makeReq_ = function(method, path, query, body, callback) {
        callback(null, { nextPageToken: token });
      };
      bq.getDatasets(function(err, datasets, nextQuery) {
        assert.deepEqual(nextQuery, {
          pageToken: token
        });
        done();
      });
    });
  });

  describe('getJobs', function() {
    it('should get jobs from the api', function(done) {
      bq.makeReq_ = function(method, path, query, body) {
        assert.equal(method, 'GET');
        assert.equal(path, '/jobs');
        assert.deepEqual(query, {});
        assert.strictEqual(body, null);
        done();
      };
      bq.getJobs(assert.ifError);
    });

    it('should accept query', function(done) {
      var queryObject = {
        allUsers: true,
        maxResults: 8,
        pageToken: 'token',
        projection: 'full',
        stateFilter: 'done'
      };
      bq.makeReq_ = function(method, path, query) {
        assert.deepEqual(query, queryObject);
        done();
      };
      bq.getJobs(queryObject, assert.ifError);
    });

    it('should return error to callback', function(done) {
      var error = new Error('Error.');
      bq.makeReq_ = function(method, path, query, body, callback) {
        callback(error);
      };
      bq.getJobs(function(err) {
        assert.equal(err, error);
        done();
      });
    });

    it('should return Job objects', function(done) {
      bq.makeReq_ = function(method, path, query, body, callback) {
        callback(null, { jobs: [{ id: 'jobId' }] });
      };
      bq.getJobs(function(err, jobs) {
        assert.ifError(err);
        assert(jobs[0] instanceof Job);
        done();
      });
    });

    it('should assign metadata to the Job objects', function(done) {
      var jobObjects = [{ a: 'b', c: 'd', id: 'jobId' }];
      bq.makeReq_ = function(method, path, query, body, callback) {
        callback(null, { jobs: jobObjects });
      };
      bq.getJobs(function(err, jobs) {
        assert.ifError(err);
        assert(jobs[0].metadata, jobObjects[0]);
        done();
      });
    });

    it('should return token if more results exist', function(done) {
      var token = 'token';
      bq.makeReq_ = function(method, path, query, body, callback) {
        callback(null, { nextPageToken: token });
      };
      bq.getJobs(function(err, jobs, nextQuery) {
        assert.deepEqual(nextQuery, {
          pageToken: token
        });
        done();
      });
    });
  });

  describe('job', function() {
    it('should return a Job object', function() {
      var jobId = 'job-id';
      var job = bq.job(jobId);
      assert(job instanceof Job);
      assert.equal(job.id, jobId);
    });
  });

  describe('makeReq_', function() {});
});
