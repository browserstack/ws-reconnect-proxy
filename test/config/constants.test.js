const { config } = require('../../lib/config/constants');
const { describe, it } = require('mocha');
const { expect } = require('chai');

describe('ConfigParser', () => {
	it('#setRetries', () => {
		expect(config.setRetries()).to.be.equal(config);
	});

	it('#setRetryDelay', () => {
		expect(config.setRetryDelay()).to.be.equal(config);
	});

	it('#setHooks', () => {
		expect(config.setHooks()).to.be.equal(config);
	});

	it('#setWorkers', () => {
		expect(config.setWorkers()).to.be.equal(config);
	});

	it('#setPort', () => {
		expect(config.setPort()).to.be.equal(config);
	});

	it('#setUpstream', () => {
		expect(config.setUpstream()).to.be.equal(config);
	});

	it('#setCloseTimer', () => {
		expect(config.setCloseTimer()).to.be.equal(config);
	});

	it('#setAlertConfig', () => {
		expect(config.setAlertConfig()).to.be.equal(config);
	});
});
