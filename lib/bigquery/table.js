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
 * @module bigquery/table
 */

'use strict';

var through = require('through2');

/**
 * Create a Table object.
 *
 * @alias module:bigquery/table
 * @constructor
 *
 * @param {string} tableId - The id of the table.
 */
function Table(dataset, tableId) {
  this.dataset = dataset;
  this.id = tableId;
}

/**
 * Copy data from one table to another, optionally creating that table.
 *
 * @param {object|string} options - The destination table or configuration
 *     object.
 * @param {function} callback - The callback function.
 *
 * @example
 * myTable.copy(destTable, function(err, job) {
 *   // Job created to copy data.
 * });
 *
 * var options = {
 *   dest: destTable,
 *   allowCreate: false // default: true
 * };
 *
 * myTable.copy(options, function(err, job) {
 *   // Job created to copy data.
 * });
 */
Table.prototype.copy = function(options, callback) {
  throw new Error('Not implemented.');
};

/**
 * Query the data from this table.
 *
 * @param {string} query - SQL query.
 * @return {ReadableStream}
 */
Table.prototype.createReadStream = function(query) {
  var that = this;
  var stream = through.obj();
  runQuery(query);
  return stream;

  function runQuery(query) {
    that.makeReq_('', '', '', '', function(err, resp) {
      if (err) {
        stream.emit('error', err);
        stream.end();
        return;
      }
      stream.push(resp.results);
      if (resp.moreResults) {
        runQuery(newQuery);
      } else {
        stream.end();
      }
    });
  }
};

/**
 * https://cloud.google.com/bigquery/loading-data-post-request#resumable
 *
 * @param {object=} metadata - Metadata to send with the upload.
 * @return {WritableStream}
 *
 * @example
 * var kittens = bq.dataset('kittens');
 *
 * fs.createReadStream('/kittens.csv')
 *   .pipe(kittens.createWriteStream());
 */
Table.prototype.createWriteStream = function(metadata) {
  throw new Error('Not implemented.');
};

/**
 * Delete a table and all its data.
 *
 * @param {function} callback - The callback function.
 *
 * @example
 * myTable.delete(function(err) {
 *   // Deletes table and all its data.
 * });
 */
Table.prototype.delete = function(callback) {
  this.makeReq_('DELETE', '', null, null, callback);
};

/**
 * Export table to Google Cloud Storage.
 *
 * @param {object} options - The configuration object.
 * @param {function} callback - The callback function.
 *
 * @example
 * var exportedFile = storage.bucket('my-bucket').file('export.csv');
 *
 * var options = {
 *   format: 'json',
 *   gzip: true, // default: false
 *   dest: exportedFile // or 'gs://my-bucket/export.csv' (accepts wildcards)
 * };
 *
 * myTable.export(options, function(err) {
 *   // Exported!
 * });
 */
Table.prototype.export = function(options, callback) {
  throw new Error('Not implemented.');
};

/**
 * Return the metadata associated with the Table.
 *
 * @param {function} callback - The callback function.
 *
 * @example
 * myTable.getMetadata(function(err, metadata) {
 *   // Use Table metadata here.
 * });
 */
Table.prototype.getMetadata = function(callback) {
  var that = this;
  this.makeReq_('GET', '', null, null, function(err, resp) {
    if (err) {
      callback(err);
      return;
    }
    that.metadata = resp;
    callback(null, that.metadata);
  });
};

/**
 * Retrieves table data from a specified set of rows.
 *
 * @todo We should automatically handle pagination.
 *
 * @param {object=} options - The configuration object.
 * @param {function} callback - The callback function.
 *
 * @example
 * var options = {
 *   maxResults: 123,
 *   startIndex: 0,
 *   pageToken: 'token'
 * };

 * myTable.getRows(options, function(err, rows) {
 *   // Use rows here.
 * });
 */
Table.prototype.getRows = function(options, callback) {
  throw new Error('Not implemented.');
};

/**
 * Stream data into BigQuery one record at a time without running a load job.
 *
 * There are more strict quota limits using this method so it is highly
 * recommended that you load data into BigQuery using Table#load() instead.
 * The one advantage to using this method is that data is immediately
 * available in BigQuery, where as Table#load()-ing may take time to process.
 *
 * @param {object} options - The configuration object.
 * @param {function} callback - The callback function.
 *
 * @example
 * myTable.insert({ dept: 'FILM', code: '1001', capacity: 42 }, function(err) {
 *   // Inserted the row.
 * });
 *
 * var rows = [
 *   { dept: 'FILM', code: '1001', capacity: 42 },
 *   { dept: 'PHIL', code: '1002', capacity: 84 },
 * ];
 *
 * myTable.insert(rows, function(err) {
 *   // Inserted the rows.
 * });
 */
Table.prototype.insert = function(options, callback) {
  throw new Error('Not implemented.');
};

/**
 * Load data from a filename, gs:// url, readable stream, or raw string. By
 * loading data this way, you create a load job that will run your data load
 * asynchronously. If you would like instantaneous access to your data in
 * BigQuery, insert it using Table#insert().
 *
 * @todo Decide on param key names here for different types of data input.
 *
 * @param {object} options - The configuration object.
 * @param {function} callback - The callback function.
 *
 * var options = {
 *   url: 'gs://my-bucket/my-data.csv',
 *   filename: '/Users/ryanseys/my-data.csv',
 *   data: 'hello,world,123',
 *
 *   format: 'csv', // or json
 *   delimiter: ';',
 *   skipHeaderRows: 1,
 *   numErrorsAllowed: 0,
 *   allowQuotedNewlines: false,
 *   allowJaggedRows: false,
 *   ignoreUnknowns: false
 *   // these options will change as necessary
 * };
 */
Table.prototype.load = function(options, callback) {
  throw new Error('Not implemented.');
};

/**
 * Set the metadata on the table.
 *
 * @todo Figure out what metadata can *actually* be set.
 * @todo Can columns be added? Removed?
 *
 * @param {object}   metadata - The metadata key/value object to set.
 * @param {Function} callback - The callback function.
 */
Table.prototype.setMetadata = function(metadata, callback) {
  throw new Error('Not implemented.');
};

/**
 * Pass through this request to Dataset's request handler, first prepending the
 * path with the table.
 *
 * @private
 *
 * @param {string} method - Action.
 * @param {string} path - Request path.
 * @param {*} query - Request query object.
 * @param {*} body - Request body contents.
 * @param {function} callback - The callback function.
 */
Table.prototype.makeReq_ = function(method, path, query, body, callback) {
  path = '/tables/' + this.id + path;
  this.dataset.makeReq_(method, path, query, body, callback);
};

module.exports = Table;
