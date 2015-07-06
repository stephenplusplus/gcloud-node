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

var assert = require('assert');
var async = require('async');
var crypto = require('crypto');
var fs = require('fs');
var request = require('request');
var through = require('through2');
var tmp = require('tmp');
var util = require('../lib/common/util');
var uuid = require('node-uuid');

var prop = util.prop;

var env = require('./env.js');
var storage = require('../lib/storage')(env);

var BUCKET_NAME = generateBucketName();

var files = {
  logo: {
    path: 'system-test/data/CloudPlatform_128px_Retina.png'
  },
  big: {
    path: 'system-test/data/three-mb-file.tif'
  }
};

function deleteFile(file, callback) {
  file.delete(callback);
}

function writeToFile(file, contents, callback) {
  var writeStream = file.createWriteStream();
  writeStream.once('error', callback);
  writeStream.once('complete', callback.bind(null, null));
  writeStream.end(contents);
}

function generateBucketName() {
  return 'gcloud-test-bucket-temp-' + uuid.v1();
}

function setHash(obj, file, done) {
  var hash = crypto.createHash('md5');
  fs.createReadStream(obj[file].path)
    .on('data', hash.update.bind(hash))
    .on('end', function() {
      obj[file].hash = hash.digest('base64');
      done();
    });
}

describe('storage', function() {
  var bucket;

  before(function(done) {
    storage.createBucket(BUCKET_NAME, function(err, newBucket) {
      assert.ifError(err);
      bucket = newBucket;
      done();
    });
  });

  after(function(done) {
    bucket.deleteFiles(function(err) {
      assert.ifError(err);
      bucket.delete(done);
    });
  });

  describe('acls', function() {
    var USER_ACCOUNT = 'user-spsawchuk@gmail.com';

    describe('buckets', function() {
      it('should get access controls', function(done) {
        bucket.acl.get(function(err, accessControls) {
          assert.ifError(err);
          assert(Array.isArray(accessControls));
          done();
        });
      });

      it('should add entity to default access controls', function(done) {
        bucket.acl.default.add({
          entity: USER_ACCOUNT,
          role: storage.acl.OWNER_ROLE
        }, function(err, accessControl) {
          assert.ifError(err);
          assert.equal(accessControl.role, storage.acl.OWNER_ROLE);

          bucket.acl.default.get({
            entity: USER_ACCOUNT
          }, function(err, accessControl) {
            assert.ifError(err);
            assert.equal(accessControl.role, storage.acl.OWNER_ROLE);

            bucket.acl.default.update({
              entity: USER_ACCOUNT,
              role: storage.acl.READER_ROLE
            }, function(err, accessControl) {
              assert.ifError(err);
              assert.equal(accessControl.role, storage.acl.READER_ROLE);

              bucket.acl.default.delete({ entity: USER_ACCOUNT }, done);
            });
          });
        });
      });

      it('should get default access controls', function(done) {
        bucket.acl.default.get(function(err, accessControls) {
          assert.ifError(err);
          assert(Array.isArray(accessControls));
          done();
        });
      });

      it('should grant an account access', function(done) {
        bucket.acl.add({
          entity: USER_ACCOUNT,
          role: storage.acl.OWNER_ROLE
        }, function(err, accessControl) {
          assert.ifError(err);
          assert.equal(accessControl.role, storage.acl.OWNER_ROLE);

          var opts = { entity: USER_ACCOUNT };

          bucket.acl.get(opts, function(err, accessControl) {
            assert.ifError(err);
            assert.equal(accessControl.role, storage.acl.OWNER_ROLE);

            bucket.acl.delete(opts, done);
          });
        });
      });

      it('should update an account', function(done) {
        bucket.acl.add({
          entity: USER_ACCOUNT,
          role: storage.acl.OWNER_ROLE
        }, function(err, accessControl) {
          assert.ifError(err);
          assert.equal(accessControl.role, storage.acl.OWNER_ROLE);

          bucket.acl.update({
            entity: USER_ACCOUNT,
            role: storage.acl.WRITER_ROLE
          }, function(err, accessControl) {
            assert.ifError(err);
            assert.equal(accessControl.role, storage.acl.WRITER_ROLE);

            bucket.acl.delete({ entity: USER_ACCOUNT }, done);
          });
        });
      });

      it('should make a bucket public', function(done) {
        bucket.makePublic(function(err) {
          assert.ifError(err);
          bucket.acl.get({ entity: 'allUsers' }, function(err, aclObject) {
            assert.ifError(err);
            assert.deepEqual(aclObject, { entity: 'allUsers', role: 'READER' });
            bucket.acl.delete({ entity: 'allUsers' }, done);
          });
        });
      });

      it('should make files public', function(done) {
        async.each(['a', 'b', 'c'], createFileWithContent, function(err) {
          assert.ifError(err);

          bucket.makePublic({ includeFiles: true }, function(err) {
            assert.ifError(err);

            bucket.getFiles(function(err, files) {
              assert.ifError(err);

              async.each(files, isFilePublic, function(err) {
                assert.ifError(err);

                async.parallel([
                  function(next) {
                    bucket.acl.default.delete({ entity: 'allUsers' }, next);
                  },
                  function(next) {
                    bucket.deleteFiles(next);
                  }
                ], done);
              });
            });
          });
        });

        function createFileWithContent(content, callback) {
          writeToFile(bucket.file(uuid() + '.txt'), content, callback);
        }

        function isFilePublic(file, callback) {
          file.acl.get({ entity: 'allUsers' }, function(err, aclObject) {
            if (err) {
              callback(err);
              return;
            }

            if (aclObject.entity === 'allUsers' &&
                aclObject.role === 'READER') {
              callback();
            } else {
              callback(new Error('File is not public.'));
            }
          });
        }
      });

      it('should make a bucket private', function(done) {
        bucket.makePublic(function(err) {
          assert.ifError(err);
          bucket.makePrivate(function(err) {
            assert.ifError(err);
            bucket.acl.get({ entity: 'allUsers' }, function(err, aclObject) {
              assert.equal(err.code, 404);
              assert.equal(err.message, 'Not Found');
              assert.equal(aclObject, null);
              done();
            });
          });
        });
      });

      it('should make files private', function(done) {
        async.each(['a', 'b', 'c'], createFileWithContent, function(err) {
          assert.ifError(err);

          bucket.makePrivate({ includeFiles: true }, function(err) {
            assert.ifError(err);

            bucket.getFiles(function(err, files) {
              assert.ifError(err);

              async.each(files, isFilePrivate, function(err) {
                assert.ifError(err);

                bucket.deleteFiles(done);
              });
            });
          });
        });

        function createFileWithContent(content, callback) {
          writeToFile(bucket.file(uuid() + '.txt'), content, callback);
        }

        function isFilePrivate(file, callback) {
          file.acl.get({ entity: 'allUsers' }, function(err) {
            if (err && err.code === 404) {
              callback();
            } else {
              callback(new Error('File is not private.'));
            }
          });
        }
      });
    });

    describe('files', function() {
      var file;

      beforeEach(function(done) {
        var options = {
          destination: uuid.v1() + '.png'
        };
        bucket.upload(files.logo.path, options, function(err, f) {
          assert.ifError(err);
          file = f;
          done();
        });
      });

      afterEach(function(done) {
        file.delete(done);
      });

      it('should get access controls', function(done) {
        file.acl.get(done, function(err, accessControls) {
          assert.ifError(err);
          assert(Array.isArray(accessControls));
          done();
        });
      });

      it('should not expose default api', function() {
        assert.equal(typeof file.default, 'undefined');
      });

      it('should grant an account access', function(done) {
        file.acl.add({
          entity: USER_ACCOUNT,
          role: storage.acl.OWNER_ROLE
        }, function(err, accessControl) {
          assert.ifError(err);
          assert.equal(accessControl.role, storage.acl.OWNER_ROLE);

          file.acl.get({ entity: USER_ACCOUNT }, function(err, accessControl) {
            assert.ifError(err);
            assert.equal(accessControl.role, storage.acl.OWNER_ROLE);

            file.acl.delete({ entity: USER_ACCOUNT }, done);
          });
        });
      });

      it('should update an account', function(done) {
        file.acl.add({
          entity: USER_ACCOUNT,
          role: storage.acl.OWNER_ROLE
        }, function(err, accessControl) {
          assert.ifError(err);
          assert.equal(accessControl.role, storage.acl.OWNER_ROLE);

          file.acl.update({
            entity: USER_ACCOUNT,
            role: storage.acl.READER_ROLE
          }, function(err, accessControl) {
            assert.ifError(err);

            assert.equal(accessControl.role, storage.acl.READER_ROLE);

            file.acl.delete({ entity: USER_ACCOUNT }, done);
          });
        });
      });

      it('should make a file public', function(done) {
        file.makePublic(function(err) {
          assert.ifError(err);
          file.acl.get({ entity: 'allUsers' }, function(err, aclObject) {
            assert.ifError(err);
            assert.deepEqual(aclObject, { entity: 'allUsers', role: 'READER' });
            file.acl.delete({ entity: 'allUsers' }, done);
          });
        });
      });

      it('should make a file private', function(done) {
        file.makePublic(function(err) {
          assert.ifError(err);
          file.makePrivate(function(err) {
            assert.ifError(err);
            file.acl.get({ entity: 'allUsers' }, function(err, aclObject) {
              assert.equal(err.code, 404);
              assert.equal(err.message, 'Not Found');
              assert.equal(aclObject, null);
              done();
            });
          });
        });
      });
    });
  });

  describe('getting buckets', function() {
    var bucketsToCreate = [
      generateBucketName(), generateBucketName()
    ];

    before(function(done) {
      async.map(bucketsToCreate, storage.createBucket.bind(storage), done);
    });

    after(function(done) {
      async.series(bucketsToCreate.map(function(bucket) {
        return function(done) {
          storage.bucket(bucket).delete(done);
        };
      }), done);
    });

    it('should get buckets', function(done) {
      storage.getBuckets(getBucketsHandler);

      var createdBuckets = [];
      var retries = 0;
      var MAX_RETRIES = 2;

      function getBucketsHandler(err, buckets, nextQuery) {
        buckets.forEach(function(bucket) {
          if (bucketsToCreate.indexOf(bucket.name) > -1) {
            createdBuckets.push(bucket);
          }
        });

        if (createdBuckets.length < bucketsToCreate.length && nextQuery) {
          retries++;

          if (retries <= MAX_RETRIES) {
            storage.getBuckets(nextQuery, getBucketsHandler);
            return;
          }
        }

        assert.equal(createdBuckets.length, bucketsToCreate.length);
        done();
      }
    });
  });

  describe('bucket metadata', function() {
    it('should allow setting metadata on a bucket', function(done) {
      var metadata = {
        website: {
          mainPageSuffix: 'http://fakeuri',
          notFoundPage: 'http://fakeuri/404.html'
        }
      };

      bucket.setMetadata(metadata, function(err, meta) {
        assert.ifError(err);
        assert.deepEqual(meta.website, metadata.website);
        done();
      });
    });
  });

  describe('write, read, and remove files', function() {
    before(function(done) {
      var doneCalled = 0;
      Object.keys(files).forEach(function(file) {
        setHash(files, file, function() {
          if (++doneCalled === Object.keys(files).length) {
            done();
          }
        });
      });
    });

    it('should read/write from/to a file in a directory', function(done) {
      var file = bucket.file('directory/file');
      var contents = 'test';

      var writeStream = file.createWriteStream({ resumable: false });
      writeStream.write(contents);
      writeStream.end();

      writeStream.on('error', done);
      writeStream.on('complete', function() {
        var data = new Buffer('');

        file.createReadStream()
          .on('error', done)
          .on('data', function(chunk) {
            data = Buffer.concat([data, chunk]);
          })
          .on('complete', function() {
            assert.equal(data.toString(), contents);
            done();
          });
      });
    });

    it('should read a byte range from a file', function(done) {
      bucket.upload(files.big.path, function(err, file) {
        assert.ifError(err);

        var fileSize = file.metadata.size;
        var byteRange = {
          start: Math.floor(fileSize * 1/3),
          end: Math.floor(fileSize * 2/3)
        };
        var expectedContentSize = byteRange.start + 1;

        var sizeStreamed = 0;
        file.createReadStream(byteRange)
          .on('data', function (chunk) {
            sizeStreamed += chunk.length;
          })
          .on('error', done)
          .on('complete', function() {
            assert.equal(sizeStreamed, expectedContentSize);
            file.delete(done);
          });
      });
    });

    it('should download a file to memory', function(done) {
      var fileContents = fs.readFileSync(files.big.path);

      bucket.upload(files.big.path, function(err, file) {
        assert.ifError(err);

        file.download(function(err, remoteContents) {
          assert.ifError(err);
          assert.equal(String(fileContents), String(remoteContents));
          done();
        });
      });
    });

    describe('stream write', function() {
      it('should stream write, then remove file (3mb)', function(done) {
        var file = bucket.file('LargeFile');
        fs.createReadStream(files.big.path)
          .pipe(file.createWriteStream({ resumable: false }))
          .on('error', done)
          .on('complete', function(fileObject) {
            assert.equal(fileObject.md5Hash, files.big.hash);
            file.delete(done);
          });
      });

      it('should write metadata', function(done) {
        var options = {
          metadata: { contentType: 'image/png' },
          resumable: false
        };

        bucket.upload(files.logo.path, options, function(err, file) {
          assert.ifError(err);

          file.getMetadata(function(err, metadata) {
            assert.ifError(err);
            assert.equal(metadata.contentType, options.metadata.contentType);
            file.delete(done);
          });
        });
      });

      it('should resume an upload after an interruption', function(done) {
        fs.stat(files.big.path, function(err, metadata) {
          assert.ifError(err);

          var fileSize = metadata.size;
          var file = bucket.file('LargeFile');

          upload({ interrupt: true }, function(err) {
            assert.ifError(err);

            upload({ interrupt: false }, function(err, metadata) {
              assert.ifError(err);

              assert.equal(metadata.size, fileSize);
              file.delete(done);
            });
          });

          function upload(opts, callback) {
            var sizeStreamed = 0;

            fs.createReadStream(files.big.path)
              .pipe(through(function(chunk, enc, next) {
                sizeStreamed += chunk.length;

                if (opts.interrupt && sizeStreamed >= fileSize / 2) {
                  // stop sending data half way through.
                  next();
                } else {
                  this.push(chunk);
                  next();
                }
              }))
              .pipe(file.createWriteStream())
              .on('error', callback)
              .on('complete', function(fileObject) {
                callback(null, fileObject);
              });
          }
        });
      });

      it('should write/read/remove from a buffer', function(done) {
        tmp.setGracefulCleanup();
        tmp.file(function _tempFileCreated(err, tmpFilePath) {
          assert.ifError(err);

          var file = bucket.file('MyBuffer');
          var fileContent = 'Hello World';

          var writable = file.createWriteStream();

          writable.write(fileContent);
          writable.end();

          writable.on('complete', function() {
            file.createReadStream()
              .pipe(fs.createWriteStream(tmpFilePath))
              .on('error', done)
              .on('finish', function() {
                file.delete(function(err) {
                  assert.ifError(err);

                  fs.readFile(tmpFilePath, function(err, data) {
                    assert.equal(data, fileContent);
                    done();
                  });
                });
              });
          });
        });
      });
    });

    it('should copy an existing file', function(done) {
      bucket.upload(files.logo.path, 'CloudLogo', function(err, file) {
        assert.ifError(err);
        file.copy('CloudLogoCopy', function(err, copiedFile) {
          assert.ifError(err);
          async.parallel([
            file.delete.bind(file),
            copiedFile.delete.bind(copiedFile)
          ], done);
        });
      });
    });
  });

  describe('combine files', function() {
    it('should combine multiple files into one', function(done) {
      var files = [
        { file: bucket.file('file-one.txt'), contents: '123' },
        { file: bucket.file('file-two.txt'), contents: '456' }
      ];

      async.each(files, createFile, function(err) {
        assert.ifError(err);

        var sourceFiles = files.map(prop('file'));
        var destinationFile = bucket.file('file-one-and-two.txt');

        bucket.combine(sourceFiles, destinationFile, function(err) {
          assert.ifError(err);

          destinationFile.download(function(err, contents) {
            assert.ifError(err);

            assert.equal(contents, files.map(prop('contents')).join(''));

            async.each(sourceFiles.concat([destinationFile]), deleteFile, done);
          });
        });
      });

      function createFile(fileObject, callback) {
        writeToFile(fileObject.file, fileObject.contents, callback);
      }
    });
  });

  describe('list files', function() {
    var filenames = ['CloudLogo1', 'CloudLogo2', 'CloudLogo3'];

    before(function(done) {
      bucket.deleteFiles(function(err) {
        assert.ifError(err);

        var file = bucket.file(filenames[0]);
        fs.createReadStream(files.logo.path)
          .pipe(file.createWriteStream())
          .on('error', done)
          .on('complete', function() {
            file.copy(filenames[1], function(err, copiedFile) {
              assert.ifError(err);
              copiedFile.copy(filenames[2], done);
            });
          });
      });
    });

    after(function(done) {
      async.parallel(
        filenames.map(function(filename) {
          return function(callback) {
            bucket.file(filename).delete(callback);
          };
        }), done);
    });

    it('should get files', function(done) {
      bucket.getFiles(function(err, files, nextQuery) {
        assert.ifError(err);
        assert.equal(files.length, filenames.length);
        assert.equal(nextQuery, null);
        done();
      });
    });

    it('should paginate the list', function(done) {
      var query = { maxResults: filenames.length - 1 };
      bucket.getFiles(query, function(err, files, nextQuery) {
        assert.ifError(err);
        assert.equal(files.length, filenames.length - 1);
        assert(nextQuery);
        bucket.getFiles(nextQuery, function(err, files) {
          assert.ifError(err);
          assert.equal(files.length, 1);
          done();
        });
      });
    });
  });

  describe('file generations', function() {
    var VERSIONED_BUCKET_NAME = generateBucketName();
    var versionedBucket;

    before(function(done) {
      var opts = { versioning: { enabled: true } };

      storage.createBucket(VERSIONED_BUCKET_NAME, opts, function(err, bucket) {
        assert.ifError(err);
        versionedBucket = bucket;
        done();
      });
    });

    afterEach(function(done) {
      versionedBucket.deleteFiles({ versions: true }, done);
    });

    after(function(done) {
      versionedBucket.delete(done);
    });

    it('should overwrite file, then get older version', function(done) {
      var VERSIONED_FILE_NAME = Date.now();
      var versionedFile = versionedBucket.file(VERSIONED_FILE_NAME);

      writeToFile(versionedFile, 'a', function(err) {
        assert.ifError(err);

        versionedFile.getMetadata(function(err, metadata) {
          assert.ifError(err);

          var initialGeneration = metadata.generation;

          writeToFile(versionedFile, 'b', function(err) {
            assert.ifError(err);

            var firstGenFile = versionedBucket.file(VERSIONED_FILE_NAME, {
              generation: initialGeneration
            });

            firstGenFile.download(function(err, contents) {
              assert.ifError(err);
              assert.equal(contents, 'a');
              done();
            });
          });
        });
      });

    });

    it('should get all files scoped to their version', function(done) {
      var filesToCreate = [
        { file: versionedBucket.file('file-one.txt'), contents: '123' },
        { file: versionedBucket.file('file-one.txt'), contents: '456' }
      ];

      async.each(filesToCreate, createFile, function(err) {
        assert.ifError(err);

        versionedBucket.getFiles({ versions: true }, function(err, files) {
          assert.ifError(err);

          // same file.
          assert.equal(files[0].name, files[1].name);

          // different generations.
          assert.notEqual(
            files[0].metadata.generation,
            files[1].metadata.generation
          );

          done();
        });
      });

      function createFile(fileObject, callback) {
        writeToFile(fileObject.file, fileObject.contents, callback);
      }
    });
  });

  describe('sign urls', function() {
    var localFile = fs.readFileSync(files.logo.path);
    var file;

    before(function(done) {
      file = bucket.file('LogoToSign.jpg');
      fs.createReadStream(files.logo.path)
        .pipe(file.createWriteStream())
        .on('error', done)
        .on('complete', done.bind(null, null));
    });

    it('should create a signed read url', function(done) {
      file.getSignedUrl({
        action: 'read',
        expires: Math.round(Date.now() / 1000) + 5
      }, function(err, signedReadUrl) {
        assert.ifError(err);
        request.get(signedReadUrl, function(err, resp, body) {
          assert.equal(body, localFile);
          file.delete(done);
        });
      });
    });

    it('should create a signed delete url', function(done) {
      file.getSignedUrl({
        action: 'delete',
        expires: Math.round(Date.now() / 1000) + 283473274
      }, function(err, signedDeleteUrl) {
        assert.ifError(err);
        request.del(signedDeleteUrl, function() {
          file.getMetadata(function(err) {
            assert.equal(err.code, 404);
            done();
          });
        });
      });
    });
  });
});
