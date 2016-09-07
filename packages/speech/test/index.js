/**
 * Copyright 2016 Google Inc. All Rights Reserved.
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
var extend = require('extend');
var fs = require('fs');
var googleProtoFiles = require('google-proto-files');
var path = require('path');
var nodeutil = require('util');
var EventEmitter = require('events');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var tmp = require('tmp');

var GrpcService = require('@google-cloud/common').GrpcService;
var util = require('@google-cloud/common').util;
var PKG = require('../package.json');

var fakeUtil = extend({}, util);

function FakeGrpcService() {
  this.calledWith_ = arguments;
  GrpcService.apply(this, arguments);
}

nodeutil.inherits(FakeGrpcService, GrpcService);

function FakeFile() {
  this.calledWith_ = arguments;
}

var requestOverride = null;
var fakeRequest = function() {
  return (requestOverride || util.noop).apply(this, arguments);
};

describe('Speech', function() {
  var FILE = './audio.raw';
  var PROJECT_ID = 'project-id';

  var Speech;
  var speech;

  before(function() {
    Speech = proxyquire('../', {
      request: fakeRequest,
      '@google-cloud/storage': {
        File: FakeFile
      },
      '@google-cloud/common': {
        GrpcService: FakeGrpcService,
        util: fakeUtil
      }
    });
  });

  beforeEach(function() {
    requestOverride = null;

    speech = new Speech({
      projectId: PROJECT_ID
    });
  });

  describe('instantiation', function() {
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

      Speech.call(fakeContext, fakeOptions);
      assert(normalizeArgumentsCalled);

      fakeUtil.normalizeArguments = normalizeArguments;
    });

    it('should inherit from GrpcService', function() {
      assert(speech instanceof GrpcService);

      var calledWith = speech.calledWith_[0];

      assert.strictEqual(calledWith.baseUrl, 'speech.googleapis.com');
      assert.strictEqual(calledWith.service, 'speech');
      assert.strictEqual(calledWith.projectIdRequired, false);
      assert.deepEqual(calledWith.scopes, [
        'https://www.googleapis.com/auth/cloud-platform'
      ]);

      assert.strictEqual(calledWith.protoServices.Speech.apiVersion, 'v1beta1');
      assert.strictEqual(
        calledWith.protoServices.Speech.path,
        googleProtoFiles.speech.v1beta1
      );
      assert.strictEqual(
        calledWith.protoServices.Speech.service,
        'cloud.speech'
      );
      assert.strictEqual(
        calledWith.protoServices.Operations.apiVersion,
        undefined
      );
      assert.strictEqual(
        calledWith.protoServices.Operations.path,
        googleProtoFiles('longrunning/operations.proto')
      );
      assert.strictEqual(
        calledWith.protoServices.Operations.service,
        'longrunning'
      );
      assert(speech.protos.Speech);
      assert(speech.protos.Operations);
      assert.strictEqual(calledWith.userAgent, PKG.name + '/' + PKG.version);
    });
  });

  describe('recognize', function() {
    var findFile_;
    var REQ = {
      encoding: 'LINEAR16'
    };
    var FILES = [
      {
        content: 'aGk='
      }
    ];

    before(function() {
      findFile_ = Speech.findFile_;
    });

    beforeEach(function() {
      Speech.findFile_ = function(files, callback) {
        callback(null, FILES);
      };
    });

    after(function() {
      Speech.findFile_ = findFile_;
    });

    it('should find the files', function(done) {
      speech.request = function(protoOpts, reqOpts) {
        assert.strictEqual(protoOpts.service, 'Speech');
        assert.strictEqual(protoOpts.method, 'syncRecognize');
        assert.deepEqual(reqOpts, {
          config: {
            encoding: 'LINEAR16'
          },
          audio: FILES[0]
        });
        done();
      };

      speech.recognize(FILES[0], REQ, assert.ifError);
    });

    it('should return an error from findFile_', function(done) {
      var error = new Error('Error.');

      Speech.findFile_ = function(files, callback) {
        assert.strictEqual(files, FILES[0]);
        callback(error);
      };

      speech.recognize(FILES[0], REQ, function(err) {
        assert.strictEqual(err, error);
        done();
      });
    });

    it('should return empty detections when none were found', function(done) {
      var RES = {
        results: []
      };
      speech.request = function(protoOpts, reqOpts, callback) {
        callback(null, RES);
      };

      speech.recognize(
        FILES[0],
        REQ,
        function(err, response, apiResponse) {
          assert.ifError(err);
          assert.deepEqual(response, RES);
          assert.strictEqual(apiResponse, RES);
          done();
        }
      );
    });

    it('should return the correct detections', function(done) {
      var expected = {
        transcript: 'foo',
        confidence: 1.00
      };
      var RES = new speech.protos.Speech.SyncRecognizeResponse({
        results: [
          {
            alternatives: [
              expected
            ]
          }
        ]
      });
      speech.request = function(protoOpts, reqOpts, callback) {
        callback(null, RES);
      };

      speech.recognize(
        FILES[0],
        REQ,
        function(err, response) {
          assert.ifError(err);
          assert.deepEqual(response, RES);
          done();
        }
      );
    });

    it('should return an error from recognize()', function(done) {
      var error = new Error('Error.');
      var RES = {};
      speech.request = function(protoOpts, reqOpts, callback) {
        callback(error, RES);
      };

      speech.recognize(FILE, REQ, function(err, response, apiResponse) {
        assert.strictEqual(err, error);
        assert.strictEqual(response, null);
        assert.strictEqual(apiResponse, RES);
        done();
      });
    });
  });

  describe('startRecognition', function() {
    var findFile_;
    var REQ = {
      encoding: 'LINEAR16'
    };
    var FILES = [
      {
        content: 'aGk='
      }
    ];

    before(function() {
      findFile_ = Speech.findFile_;
    });

    beforeEach(function() {
      Speech.findFile_ = function(files, callback) {
        assert.strictEqual(files, FILES[0]);
        callback(null, FILES);
      };
    });

    after(function() {
      Speech.findFile_ = findFile_;
    });

    it('should find the files', function(done) {
      speech.request = function(protoOpts, reqOpts) {
        assert.strictEqual(protoOpts.service, 'Speech');
        assert.strictEqual(protoOpts.method, 'asyncRecognize');
        assert.deepEqual(reqOpts, {
          config: {
            encoding: 'LINEAR16'
          },
          audio: FILES[0]
        });

        done();
      };

      speech.startRecognition(FILES[0], REQ, assert.ifError);
    });

    it('should return an error from findFile_', function(done) {
      var error = new Error('Error.');

      Speech.findFile_ = function(files, callback) {
        assert.strictEqual(files, FILE);
        callback(error);
      };

      speech.startRecognition(FILE, REQ, function(err) {
        assert.strictEqual(err, error);
        done();
      });
    });

    it('should return an error from speech.request', function(done) {
      var error = new Error('Error.');

      speech.request = function(protoOpts, reqOpts, callback) {
        callback(error);
      };

      speech.startRecognition(FILES[0], REQ, function(err) {
        assert.strictEqual(err, error);
        done();
      });
    });

    it('should return operation', function(done) {
      var fakeApiResponse = {
        name: '1234'
      };
      var fakeOperation = speech.operation(fakeApiResponse);
      speech.operation = sinon.stub().returns(fakeOperation);
      speech.request = function(protoOpts, reqOpts, callback) {
        assert.deepEqual(reqOpts, {
          audio: {
            content: 'aGk='
          },
          config: {
            encoding: 'LINEAR16'
          }
        });
        callback(null, fakeApiResponse);
      };

      speech.startRecognition(
        FILES[0],
        REQ,
        function(err, operation, apiResponse) {
          assert.ifError(err);
          assert.strictEqual(operation, fakeOperation);
          assert.strictEqual(apiResponse, fakeApiResponse);
          done();
        }
      );
    });
  });

  describe('createRecognizeStream', function() {
    var REQ = {};

    it('should make the correct API request', function(done) {
      var expected = 'how old is the Brooklyn Bridge';
      var filePath = '../system-test/data/bridge.raw';
      var audioFile = fs.readFileSync(path.join(__dirname, filePath));
      var request = REQ;
      var upstreamWriteCount = 0;
      var mockStream = {
        write: function(data) {
          upstreamWriteCount++;
          assert(data);
          if (upstreamWriteCount === 1) {
            assert.deepEqual(data, {
              streamingConfig: REQ
            });
            assert.strictEqual(data.streamingConfig, REQ);
          } else if (upstreamWriteCount === 2) {
            assert(data.audioContent);
          }
        },
        on: function(event, handler) {
          if (event === 'response') {
            this.responseHandler = handler;
          }
        },
        emit: function(event, data) {
          if (event === 'data') {
            this.pipeTo.write(data);
          } else if (event === 'response') {
            this.responseHandler(data);
          }
        },
        once: function() {},
        pipe: function(stream) {
          this.pipeTo = stream;
        }
      };

      speech.requestWritableStream = function(protoOpts) {
        assert.strictEqual(protoOpts.service, 'Speech');
        assert.strictEqual(protoOpts.method, 'streamingRecognize');
        return mockStream;
      };

      var stream = speech.createRecognizeStream(request);
      assert(stream !== mockStream);

      stream.on('data', function(data) {
        assert.deepEqual(data, {
        results: [
          {
            alternatives: [
              {
                transcript: expected
              }
            ]
          }
        ]
      });
        assert.equal(upstreamWriteCount, 2, 'two upstream writes');
        done();
      });

      stream.write(audioFile);
      mockStream.emit('response', 'response');
      mockStream.emit('data', {
        results: [
          {
            alternatives: [
              {
                transcript: expected
              }
            ]
          }
        ]
      });
    });
  });

  describe('operation', function() {
    it('should make an operation instance', function() {
      var operation = speech.operation('1234');
      assert(operation instanceof Speech.Operation);
      assert.equal(operation.name, '1234');
    });

    it('should require a name', function() {
      assert.throws(function() {
        speech.operation();
      }, Error, 'A name must be specified for an operation.');
      assert.throws(function() {
        speech.operation({});
      }, Error, 'A name must be specified for an operation.');
    });

    it('should accept an object', function() {
      var operation = speech.operation({
        name: '1234'
      });
      assert.equal(operation.name, '1234');
    });
  });

  describe('findFile_', function() {
    it('should convert a File object', function(done) {
      var file = new FakeFile();
      file.bucket = {
        name: 'bucket-name'
      };
      file.name = 'file-name';

      Speech.findFile_(file, function(err, foundFile) {
        assert.ifError(err);

        assert.deepEqual(foundFile, {
          uri: 'gs://' + file.bucket.name + '/' + file.name
        });

        done();
      });
    });

    it('should detect a gs:// path', function(done) {
      var file = 'gs://your-bucket-name/audio.raw';

      Speech.findFile_(file, function(err, foundFile) {
        assert.ifError(err);

        assert.deepEqual(foundFile, {
          uri: file
        });

        done();
      });
    });

    it('should get a file from a URL', function(done) {
      var fileUri = 'http://www.google.com/audio.raw';
      var body = 'body';

      requestOverride = function(reqOpts) {
        assert.strictEqual(reqOpts.method, 'GET');
        assert.strictEqual(reqOpts.uri, fileUri);

        var resp = new EventEmitter();
        setTimeout(function() {
          resp.emit('data', new Buffer(body));
          resp.stream.write(new Buffer(body));
          resp.emit('end');
          resp.stream.end();
        }, 250);
        resp.pipe = function(stream) {
          resp.stream = stream;
        };
        return resp;
      };

      Speech.findFile_(fileUri, function(err, foundFile) {
        assert.ifError(err);
        assert.deepEqual(foundFile, {
          content: new Buffer(body)
        });
        done();
      });
    });

    it('should return an error from reading a URL', function(done) {
      var fileUri = 'http://www.google.com/audio.raw';
      var error = new Error('Error.');

      requestOverride = function() {
        var resp = new EventEmitter();
        setTimeout(function() {
          resp.emit('error', error);
          resp.stream.emit('error');
        }, 250);
        resp.pipe = function(stream) {
          resp.stream = stream;
        };
        return resp;
      };

      Speech.findFile_(fileUri, function(err) {
        assert.strictEqual(err, error);
        done();
      });
    });

    it('should validate RecognitionAudio object', function(done) {
      var file = {};

      Speech.findFile_(file, function(err) {
        assert(err);
        assert.equal(err.message, 'RecognitionAudio object requires a ' +
          '"content" or "uri" property!');
        done();
      });
    });

    it('should accept RecognitionAudio object', function(done) {
      var file = {
        content: 'aGk='
      };

      Speech.findFile_(file, function(err, foundFile) {
        assert.ifError(err);
        assert.strictEqual(foundFile, file);

        done();
      });
    });

    it('should read from a file path', function(done) {
      tmp.setGracefulCleanup();

      tmp.file(function tempFileCreated_(err, tmpFilePath) {
        assert.ifError(err);

        var contents = 'abcdef';

        function writeFile(callback) {
          fs.writeFile(tmpFilePath, contents, callback);
        }

        function convertFile(callback) {
          Speech.findFile_(tmpFilePath, callback);
        }

        async.waterfall([writeFile, convertFile], function(err, foundFile) {
          assert.ifError(err);

          assert.deepEqual(foundFile, {
            content: new Buffer(contents)
          });

          done();
        });
      });
    });

    it('should return an error when file cannot be found', function(done) {
      Speech.findFile_('./not-real-file.raw', function(err) {
        assert.strictEqual(err.code, 'ENOENT');
        done();
      });
    });
  });

  describe('detectEncoding_', function() {
    it('should detect encoding', function() {
      assert.equal(Speech.detectEncoding_(), undefined);
      assert.equal(Speech.detectEncoding_(''), undefined);
      assert.equal(Speech.detectEncoding_('foo'), undefined);
      assert.equal(Speech.detectEncoding_('foo.'), undefined);
      assert.equal(Speech.detectEncoding_('foo.bar'), undefined);
      assert.equal(Speech.detectEncoding_('foo.bar.bar'), undefined);
      assert.equal(Speech.detectEncoding_('foo.raw'), 'LINEAR16');
      assert.equal(Speech.detectEncoding_('foo.amr'), 'AMR');
      assert.equal(Speech.detectEncoding_('foo.awb'), 'AMR_WB');
      assert.equal(Speech.detectEncoding_('foo.flac'), 'FLAC');
      assert.equal(Speech.detectEncoding_('foo.fLAc'), 'FLAC');
      assert.equal(Speech.detectEncoding_('foo.wav'), 'MULAW');
      assert.equal(Speech.detectEncoding_('foo.au'), 'MULAW');
    });
  });
});
