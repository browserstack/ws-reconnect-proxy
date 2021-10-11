const { describe, it, beforeEach } = require('mocha');
const sinon = require('sinon');
const { expect } = require('chai');
const logger = require('../../lib/util/loggerFactory');
const AlertManager = require('../../lib/util/AlertManager');

describe('#AlertManager', () => {
  let alertManager;
  beforeEach(() => {
    alertManager = new AlertManager();
  });

  describe('#sendAlert', () => {
    it('should log & send alert', () => {
      const loggerStub = sinon.stub(logger, 'info');
      alertManager.sendAlert('SUBJECT', 'MESSAGE');
      expect(loggerStub.calledOnce).to.be.equal(true);
      loggerStub.restore();
    });
  });
});
