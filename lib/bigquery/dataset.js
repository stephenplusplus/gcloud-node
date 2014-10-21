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
 * @module bigquery/dataset
 */

'use strict';

var extend = require('extend');

/**
 * @type {module:bigquery/table}
 * @private
 */
var Table = require('./table.js');

/**
 * @type {module:common/util}
 * @private
 */
var util = require('../common/util.js');

/*! Developer Documentation
 *
 * @param {module:bigquery} bigQuery - The parent BigQuery instance.
 * @param {string} datasetId - The id of the Dataset.
 */
/**
 * Interact with your BigQuery dataset. Create a Dataset instance with
 * {@link module:bigquery#createDataset} or {@link module:bigquery#dataset}.
 *
 * @alias module:bigquery/dataset
 * @constructor
 */
function Dataset(bigQuery, datasetId) {
  this.bigQuery = bigQuery;
  this.id = datasetId;
}

/**
 * Create a table given a tableId or configuration object.
 *
 * @param {object} options - Table id or configuration object.
 * @param {string} options.id - The id of the table.
 * @param {string|object} options.schema - A comma-separated list of name:type
 *     pairs. Valid types are "string", "integer", "float", "boolean", and
 *     "timestamp". If the type is omitted, it is assumed to be "string".
 *     Example: "name:string, age:integer". Schemas can also be specified as a
 *     JSON array of fields, which allows for nested and repeated fields. See
 *     https://cloud.google.com/bigquery/docs/reference/v2/tables#resource for
 *     more detailed information.
 * @param {function} callback - The callback function.
 *
 * @example
 * myDataset.createTable('customers', function(err, table) {
 *   // Use the table.
 * });
 *
 * var tableConfig = {
 *   id: 'my-kittens',
 *   // breed and name are defaulted to type = string
 *   schema: 'id:integer,breed,name,dob:timestamp' // or json nested fields
 * };
 *
 * myDataset.createTable(tableConfig, function(err, table) {
 *   // Use the table.
 * });
 */
Dataset.prototype.createTable = function(options, callback) {
  if (util.is(options.schema, 'string')) {
    options.schema =
      options.schema.split(/\s*,\s*/).reduce(function(acc, pair) {
        acc.fields.push({
          name: pair.split(':')[0],
          type: pair.split(':')[1] || 'string'
        });
        return acc;
      }, { fields: [] });
  }
  var body = {
    schema: options.schema,
    tableReference: {
      datasetId: this.id,
      projectId: this.bigQuery.projectId,
      tableId: options.id
    }
  };
  delete options.id;
  delete options.schema;
  extend(true, body, options);
  this.makeReq_('POST', '/tables', null, body, function(err, resp) {
    if (err) {
      callback(err);
      return;
    }
    var table = this.table(resp.tableReference.tableId);
    table.metadata = resp;
    callback(null, table);
  }.bind(this));
};

/**
 * Delete the dataset.
 *
 * @param {object=} options - The configuration object.
 * @param {boolean} options.force - Force delete dataset and all tables.
 *     (default: false)
 * @param {function} callback - The callback function.
 *
 * @example
 * myDataset.delete(function(err) {
 *   // Deletes a dataset only if it does not have any tables.
 * });
 *
 * myDataset.delete({ force: true }, function(err) {
 *   // Deletes dataset and any tables it contains.
 * });
 */
Dataset.prototype.delete = function(options, callback) {
  if (!callback) {
    callback = options;
    options = {};
  }
  var query = { deleteContents: !!options.force };
  this.makeReq_('DELETE', '', query, null, callback);
};

/**
 * Get the metadata for the Dataset.
 *
 * @param {function} callback - The callback function.
 *
 * @example
 * myDataset.getMetadata(function(err, metadata) {
 *   if (!err) {
 *     // Use metadata object. myDataset is already automatically updated.
 *   }
 * });
 */
Dataset.prototype.getMetadata = function(callback) {
  this.makeReq_('GET', '', null, null, function(err, resp) {
    if (err) {
      callback(err);
      return;
    }
    this.metadata = resp;
    callback(null, this.metadata);
  }.bind(this));
};

/**
 * Get a list of tables.
 *
 * @param {object=} query - Configuration object.
 * @param {number} query.maxResults - Maximum number of results to return.
 * @param {string} query.pageToken - Token returned from a previous call, to
 *     request the next page of results.
 * @param {function} callback - The callback function.
 *
 * @example
 * var myDataset = bigquery.dataset(datasetId);
 *
 * myDataset.getTables(function(err, tables, nextQuery) {
 *   // If `nextQuery` is non-null, there are more results to fetch.
 * });
 */
Dataset.prototype.getTables = function(query, callback) {
  var that = this;
  if (!callback) {
    callback = query;
    query = {};
  }
  query = query || {};
  this.makeReq_('GET', '/tables', query, null, function(err, resp) {
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
    var tables = (resp.tables || []).map(function(tableObject) {
      var table = that.table(tableObject.id);
      table.metadata = tableObject;
      return table;
    });
    callback(null, tables, nextQuery);
  });
};

/**
 * Sets the metadata of the Dataset object.
 *
 * @param {object} metadata - Metadata to save on the Dataset.
 * @param {function} callback - The callback function.
 *
 * @example
 * var metadata = {
 *   description: 'kittens dataset'
 * };
 *
 * myDataset.setMetadata(metadata, function(err) {
 *   if (!err) {
 *     // Use updated myDataset.
 *   }
 * });
 */
Dataset.prototype.setMetadata = function(metadata, callback) {
  this.makeReq_('PUT', '', null, metadata, function(err, resp) {
    if (err) {
      callback(err);
      return;
    }
    this.metadata = resp;
    callback(null, this.metadata);
  }.bind(this));
};

/**
 * Return a new instance of reference to an existing Table object.
 *
 * @param {string} tableId - The ID of the table.
 * @return {module:bigquery/table}
 *
 * @example
 * var kittens = myDataset.table('my-kittens');
 */
Dataset.prototype.table = function(tableId) {
  return new Table(this, tableId);
};

/**
 * Pass through this request to BigQuery's request handler, first prepending the
 * path with the dataset.
 *
 * @private
 *
 * @param {string} method - Action.
 * @param {string} path - Request path.
 * @param {*} query - Request query object.
 * @param {*} body - Request body contents.
 * @param {function} callback - The callback function.
 */
Dataset.prototype.makeReq_ = function(method, path, query, body, callback) {
  path = '/datasets/' + this.id + path;
  this.bigQuery.makeReq_(method, path, query, body, callback);
};

module.exports = Dataset;
