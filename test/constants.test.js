const { config } = require('../constants');
const mocha = require('mocha');
const { expect } = require('chai');


describe('ConfigParser', () => {

  it('#setupRetries', () => {
    expect(config.setupRetries()).to.be.equal(config);
  });

  it('#setupRetryDelay', () => {
    expect(config.setupRetryDelay()).to.be.equal(config);
  });

  it('#setupRetryDelay', () => {
    expect(config.decideMode()).to.be.equal(config);
  });

  it('#setupHooks', () => {
    expect(config.setupHooks()).to.be.equal(config);
  });

  it('#setWorkers', () => {
    expect(config.setWorkers()).to.be.equal(config);
  });

  it('#setPort', () => {
    expect(config.setSenderUpstream()).to.be.equal(config);
  });

  it('#setReceiverUpstream', () => {
    expect(config.setSenderUpstream()).to.be.equal(config);
  });
});