const { describe, it, beforeEach } = require('mocha');
const sinon = require('sinon');
const { expect } = require('chai');
const logger = require('../../lib/util/loggerFactory');
const ErrorHandler = require('../../lib/util/ErrorHandler');
const AlertManager = require('../../lib/util/AlertManager');

describe('#ErrorHandler', () => {
  let errorHandler;
  beforeEach(() => {
    errorHandler = new ErrorHandler(new AlertManager());
  });

  describe('#onError', () => {
    it('should log global exception', () => {
      const loggerStub = sinon.stub(logger, 'error');
      errorHandler.onError({
        stack: 'I am stacktrace!',
      });
      expect(loggerStub.calledOnce).to.be.equal(true);
      loggerStub.restore();
    });

    it('should send alert', () => {
      process.env.NODE_ENV = 'prod';
      const loggerStub = sinon.stub(logger, 'error');
      errorHandler.onError('I am error');
      expect(loggerStub.calledOnce).to.be.equal(true);
      loggerStub.restore();
      process.env.NODE_ENV = 'test';
    });
  });
});
