const {
	incrReconnectionCount,
	incrActiveConnectionCount,
	incrNewConnect,
	incrMessagesCount,
	incrClosedConnectionCount,
	incrErrorConnectionCount,
	decrActiveConnectionCount,
	getMetrics,
	setMetrics,
} = require('../../lib/util/metrics');
const { describe, it } = require('mocha');
const { expect } = require('chai');

describe('#incrReconnectCount', () => {
	it('should increment reconnect connection count', () => {
		incrReconnectionCount();
		expect(getMetrics().reconnectionCount).to.be.greaterThanOrEqual(1);
	});
});

describe('#incrActiveConnectionCount', () => {
	it('should increment active connection count', () => {
		incrActiveConnectionCount();
		expect(getMetrics().activeConnectionCount).to.be.greaterThanOrEqual(1);
	});
});

describe('#incrNewConnect', () => {
	it('should increment new connection count', () => {
		incrNewConnect();
		expect(getMetrics().newConnectionsCount).to.be.greaterThanOrEqual(1);
	});
});

describe('#incrMessagesCount', () => {
	it('should increment messages count', () => {
		incrMessagesCount();
		expect(getMetrics().messagesCount).to.be.greaterThanOrEqual(1);
	});
});

describe('#incrClosedConnectionCount', () => {
	it('should increment closed connection count', () => {
		incrClosedConnectionCount();
		expect(getMetrics().closedConnectionCount).to.be.greaterThanOrEqual(1);
	});
});

describe('#incrErrorConnectionCount', () => {
	it('should increment error connection count', () => {
		incrErrorConnectionCount();
		expect(getMetrics().errorConnectionCount).to.be.greaterThanOrEqual(1);
	});
});

describe('#decrActiveConnectionCount', () => {
	it('should decrement active connection count', () => {
		decrActiveConnectionCount();
		expect(getMetrics().activeConnectionCount).to.be.greaterThanOrEqual(1);
	});
});

describe('#setMetric', () => {
	it('should set metric', () => {
		setMetrics();
		expect(getMetrics().messagesCount).to.be.equal(0);
	});
});

describe('#getMetric', () => {
	it('should get metric', () => {
		expect(getMetrics()).not.to.be.undefined;
	});
});
