const Instrumentation = require('../../lib/util/Instrumentation');
const { describe, it, beforeEach } = require('mocha');
const sinon = require('sinon');
const { expect } = require('chai');
const logger = require('../../lib/util/loggerFactory');

describe('typeSanity', () => {
  let instrumentation;
  beforeEach(() => {
    instrumentation = new Instrumentation();
  });

  describe('#pushMetrics', () => {
    it('should log metrics', () => {
      const loggerStub = sinon.stub(logger, 'info');
      instrumentation.pushMetrics();
      expect(loggerStub.calledOnce).to.be.equal(true);
      loggerStub.restore();
    });
  });
});
