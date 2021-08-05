const {
	createTarget,
	extractReconnectId,
	extractConnectionId,
	isReconnectHeader,
} = require('../util');
const { describe, it } = require('mocha');
const { expect } = require('chai');

describe('#createTarget', () => {
	it('should return url', () => {
		expect(createTarget('/somecaps')).to.be.contains('/somecaps');
	});
});

describe('#extractReconnectId', () => {
	it('should return reconnect id', () => {
		const headers = {
			'x-reconnect-id': 'TEST123',
		};
		expect(extractReconnectId(headers)).to.be.equal('TEST123');
	});

	it('should return undefined if no reconnect id header present', () => {
		const headers = {};
		expect(extractReconnectId(headers)).to.be.equal(undefined);
	});
});

describe('#extractConnectionId', () => {
	it('should return connection id', () => {
		const headers = {
			'x-connection-id': 'TEST123',
		};
		expect(extractConnectionId(headers)).to.be.equal('TEST123');
	});

	it('should return undefined if connection id header absent', () => {
		const headers = {};
		expect(extractConnectionId(headers)).to.be.equal(undefined);
	});
});

describe('#isReconnectHeader', () => {
	it('should return true if reconnect header present', () => {
		const headers = {
			'x-reconnect-id': 'TEST123',
		};
		expect(isReconnectHeader(headers)).to.be.equal(true);
	});

	it('should return false if reconnect header absent', () => {
		const headers = {};
		expect(isReconnectHeader(headers)).to.be.equal(false);
	});
});
