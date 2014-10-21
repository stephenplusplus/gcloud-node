/*!
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

/*!
 * @module bigquery
 */

'use strict';

/**
 * @const {string} Base URL for the BigQuery API.
 * @private
 */
var BIGQUERY_BASE_URL = 'https://www.googleapis.com/bigquery/v2/projects/';

/**
 * @type module:common/connection
 * @private
 */
var conn = require('../common/connection.js');

/**
 * @type module:bigquery/dataset
 * @private
 */
var Dataset = require('./dataset.js');

var extend = require('extend');

/**
 * @type module:bigquery/job
 * @private
 */
var Job = require('./job.js');

/**
 * Required scopes for Google Cloud BigQuery API.
 *
 * @const {array}
 * @private
 */
var SCOPES = ['https://www.googleapis.com/auth/bigquery'];

/**
 * @type module:common/util
 * @private
 */
var util = require('../common/util.js');

/**
 * BigQuery API client.
 *
 * @alias module:bigquery
 * @constructor
 *
 * @param {object=} options - The configuration object.
 */
function BigQuery(options) {
  options = options || {};

  this.connection = new conn.Connection({
    credentials: options.credentials,
    keyFilename: options.keyFilename,
    scopes: SCOPES
  });
  this.projectId = options.projectId;
}

/**
 * Create a dataset.
 *
 * @param {string} datasetId - ID of the dataset.
 * @param {function} callback  - The callback function.
 *
 * @example
 * bigquery.createDataset('kittens', function(err, dataset) {
 *   // Use the newly created Dataset to create tables.
 * });
 */
BigQuery.prototype.createDataset = function(datasetId, callback) {
  var body = {
    datasetReference: {
      datasetId: datasetId
    }
  };
  this.makeReq_('POST', '/datasets', null, body, function(err, resp) {
    if (err) {
      callback(err);
      return;
    }
    var dataset = this.dataset(this, datasetId);
    dataset.metadata = resp;
    callback(null, dataset);
  }.bind(this));
};

/**
 * Create a reference to an existing dataset.
 *
 * @param {string} datasetId - ID of the dataset.
 * @return {module:bigquery/dataset}
 */
BigQuery.prototype.dataset = function(datasetId) {
  return new Dataset(this, datasetId);
};

/**
 * List all or some of the BigQuery datasets.
 *
 * @param {object=} query - Configuration object.
 * @param {boolean=} query.all - List all datasets, including hidden ones.
 * @param {number=} query.maxResults - Maximum number of results to return.
 * @param {string=} query.pageToken - Token returned from a previous call, to
 *     request the next page of results.
 * @param {function} callback - The callback function.
 *
 * @example
 * bigquery.getDatasets({
 *   all: true,
 *   maxResults: 10
 * }, function(err, datasets, nextQuery) {
 *   // If `nextQuery` is non-null, there are more results to fetch.
 * });
 */
BigQuery.prototype.getDatasets = function(query, callback) {
  var that = this;
  if (!callback) {
    callback = query;
    query = {};
  }
  query = query || {};
  this.makeReq_('GET', '/datasets', query, null, function(err, resp) {
    if (err) {
      callback(err);
      return;
    }
    var nextQuery = null;
    if (resp.nextPageToken) {
      nextQuery = extend({}, query, {
        pageToken: resp.nextPageToken
      });
    }
    var datasets = (resp.datasets || []).map(function(dataset) {
      var ds = that.dataset(that, dataset.datasetReference.datasetId);
      ds.metadata = dataset;
      return ds;
    });
    callback(null, datasets, nextQuery);
  });
};

/**
 * Get the list of jobs.
 *
 * @param {object=} query - Configuration object.
 * @param {boolean=} query.allUsers - Display jobs owned by all users in the
 *     project.
 * @param {number=} query.maxResults - Maximum number of results to return.
 * @param {string=} query.pageToken - Token returned from a previous call, to
 *     request the next page of results.
 * @param {string=} query.projection - Restrict information returned to a set of
 *     selected fields. Acceptable values are "full", for all job data, and
 *     "minimal", to not include the job configuration.
 * @param {string=} query.stateFilter - Filter for job state. Acceptable values
 *     are "done", "pending", and "running".
 * @param {function} callback - The callback function.
 *
 * @example
 * bigquery.getJobs(function(err, jobs) {
 *   // Use list of jobs here.
 * });
 *
 * var query = {
 *   maxResults: 3 // only show max 3 results
 * };
 * bigquery.getJobs(query, function(err, jobs) {
 *   // Use list of jobs here.
 * });
 */
BigQuery.prototype.getJobs = function(query, callback) {
  var that = this;
  if (!callback) {
    callback = query;
    query = {};
  }
  query = query || {};
  this.makeReq_('GET', '/jobs', query, null, function(err, resp) {
    if (err) {
      callback(err);
      return;
    }
    var nextQuery = null;
    if (resp.nextPageToken) {
      nextQuery = extend({}, query, {
        pageToken: resp.nextPageToken
      });
    }
    var jobs = (resp.jobs || []).map(function(jobObject) {
      var job = that.job(jobObject.id);
      job.metadata = jobObject;
      return job;
    });
    callback(null, jobs, nextQuery);
  });
};

/**
 * Create a reference to an existing Job.
 *
 * @param {string} jobId - ID of the job.
 * @return {type:bigquery/job}
 *
 * @example
 * var myExistingJob = bigquery.job('my-job-id');
 */
BigQuery.prototype.job = function(jobId) {
  return new Job(jobId);
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
BigQuery.prototype.makeReq_ = function(method, path, q, body, callback) {
  var reqOpts = {
    method: method,
    qs: q,
    uri: BIGQUERY_BASE_URL + this.projectId + path
  };
  if (body) {
    reqOpts.json = body;
  }
  this.connection.req(reqOpts, function(err, res, body) {
    util.handleResp(err, res, body, callback);
  });
};

module.exports = BigQuery;
