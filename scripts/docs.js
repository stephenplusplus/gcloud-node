'use strict';

var async = require('async');
var dox = require('dox');
var fs = require('fs');
var globby = require('globby');

var INPUT = [
  './lib/**/*.js',
  '!./lib/common/*.js'
];
var OUTPUT = './docs/json/master/all.json';

function flatten(arr) {
  return arr.reduce(function(acc, obj) {
    var key = Object.keys(obj)[0];
    acc[key] = obj[key];
    return acc;
  }, {});
}

function filePathToRoute(filePath) {
  return filePath
    .replace('./lib/', '')
    .replace('/index.js', '')
    .replace('.js', '');
}

function parseFile(filePath, callback) {
  fs.readFile(filePath, 'utf8', function(err, contents) {
    if (err) {
      callback(err);
      return;
    }

    var parsed = {};
    parsed[filePathToRoute(filePath)] = dox.parseComments(contents);

    callback(null, parsed);
  });
}

globby(INPUT)
  .then(function(files) {
    async.map(files, parseFile, function(err, fileObjects) {
      if (err) {
        throw err;
      }

      var flattened = flatten(fileObjects);

      flattened.gcloud = flattened.index;
      delete flattened.index;

      flattened['search/index'] = flattened['search/index-class'];
      delete flattened['search/index-class'];

      flattened._DELIMITER = '/';

      fs.writeFile(OUTPUT, JSON.stringify(flattened), function(err) {
        if (err) {
          throw err;
        }
      });
    });
  });
