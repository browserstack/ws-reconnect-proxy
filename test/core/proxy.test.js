const Proxy = require('../../lib/core/Proxy');
const Context = require('../../lib/core/Context');
const { describe, it, before, after } = require('mocha');
const { expect } = require('chai');
const { spy, stub } = require('sinon');
const { kAddNewContext } = require('../../lib/config/constants');
const http = require('http');

describe('Proxy', () => {
	before(() => {
		this.upstreamUrl = 'ws://localhost:8991/';
		this.socket = {
			close: spy(),
			terminate: spy(),
			on: spy(),
			send: spy(),
		};

		this.request = {
			pipe: spy(),
			url: this.upstreamUrl,
			headers: {
				'x-connection-id': 'CONNECTION_ID',
			},
		};

		this.response = {
			writeHead: spy(),
		};

		this.proxy = new Proxy();
	});

	after(() => {
		this.proxy.httpServer.close();
		this.proxy.server.close();
	});

	it('should handle request', ()  =>{
		const requestStub = stub(http, 'request');
		this.proxy.requestHandler(this.request, this.response);
		expect(requestStub.calledOnce).to.be.equal(true);
	});

	it('should set connection id', () => {
		this.proxy.connectionHandler(this.socket, this.request);
		expect(this.proxy.contexts.has('CONNECTION_ID')).to.be.equal(true);
	});

	it('should add new context', () => {
		this.proxy.connectionHandler(this.socket, this.request);
		const context = this.proxy.contexts.get('CONNECTION_ID');
		context.on(kAddNewContext, (connectionId) => {
			expect(this.proxy.contexts.has(connectionId)).to.be.equal(true);
		});
		context.emit(kAddNewContext, 'NEW_CONNECTION_ID');
	});

	it('should reconnect and add new connection', () => {
		const request = {
			url: this.upstreamUrl,
			headers: {
				'x-reconnect-id': 'DUMMY_CONNECTION_ID',
				'x-connection-id': 'DUMMY_CONNECTION_ID',
			},
		};
		const context = new Context(request.headers['x-connection-id']);
		this.proxy.contexts.set(request.headers['x-connection-id'], context);
		this.proxy.connectionHandler(this.socket, request);
		expect(
			this.proxy.contexts.has(request.headers['x-reconnect-id'])
		).to.be.equal(true);
	});

	it('should not have connection id', () => {
		const request = {
			url: this.upstreamUrl,
			headers: {
				'x-reconnect-id': 'TEST_CONNECTION_ID',
				'x-connection-id': 'TEST_CONNECTION_ID',
			},
		};
		this.proxy.connectionHandler(this.socket, request);
		expect(
			this.proxy.contexts.has(request.headers['x-reconnect-id'])
		).to.be.equal(false);
	});
});
