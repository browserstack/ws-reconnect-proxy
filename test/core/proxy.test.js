const Proxy = require('../../lib/core/Proxy');
const Context = require('../../lib/core/Context');
const { describe, it, before, after, beforeEach, afterEach } = require('mocha');
const { expect, assert: assertChai } = require('chai');
const { spy, stub, restore } = require('sinon');
const { kAddNewContext } = require('../../lib/config/constants');
const http = require('http');
const { assert } = require('console');
const proxyquire = require('proxyquire');
const CustomRequestHandler = require('../../lib/core/CustomRequestHandler');

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
      end: spy(),
    };

    this.proxy = new Proxy();
  });

  after(() => {
    this.proxy.httpServer.close();
    this.proxy.server.close();
  });

  it('should handle request', () => {
    const requestSpy = spy(http, 'request');
    this.proxy.requestHandler(this.request, this.response);
    expect(requestSpy.calledOnce).to.be.equal(true);
    requestSpy.restore();
  });

  describe('customRequest', () => {
    let customRequestEnabled;
    let ProxyWithMock;
    let proxyWsCustom;
    let responseMock;
    let requestMock;

    beforeEach(() => {
      // Stub the environment variable to return 'true'
      customRequestEnabled = true;
      // Stub the module with the custom environment variable value
      ProxyWithMock = proxyquire('../../lib/core/Proxy', {
        '../../lib/config/constants': {
          customRequestEnabled,
          config: {
            workers: 1,
            port: 8000,
            hostname: '127.0.0.1',
            upstream: 'ws://localhost:8000',
            retryDelay: 10000,
            closeTimer: 15000,
            enableInstrumentation: true,
            instrumentationTimer: 60000,
          },
        },
      });
      proxyWsCustom = new ProxyWithMock();
      stub(http, 'request');
      // Create mocks for request and response objects
      responseMock = {
        writeHead: stub(),
        end: stub(),
      };
      requestMock = new http.IncomingMessage();
    });

    afterEach(() => {
      restore();
      proxyWsCustom.httpServer.close();
      proxyWsCustom.server.close();
    });

    it('should handle custom request', (done) => {
      // Set up request object
      stub(CustomRequestHandler, 'getInstance').returns({
        addCustomRequest: stub().returns({
          promise: Promise.resolve(),
        }),
        customRequestList: {
          123: {
            promise: Promise.resolve(),
          },
        },
      });
      requestMock.url = '/customRequest';
      requestMock.method = 'POST';

      // Stub the 'on' method to capture 'data' and 'end' event callbacks
      const requestOnStub = stub();
      requestOnStub
        .withArgs('data')
        .callsArgWith(
          1,
          JSON.stringify({ command: { id: '123', command: 'mockCommand' } })
        );
      requestOnStub.withArgs('end').callsArg(1);
      requestMock.on = requestOnStub;

      // Stub the 'send' method of the outgoing socket
      const outgoingSocketStub = {
        send: stub(),
      };

      // Stub the 'getContexts' method to return a mock context
      const getContextsStub = stub().returns(
        new Map([['mockContextId', { outgoingSocket: outgoingSocketStub }]])
      );

      // Stub the 'contexts' property of the class instance to return the mock context
      stub(proxyWsCustom, 'contexts').get(getContextsStub);
      proxyWsCustom.requestHandler(requestMock, responseMock);
      assertChai.isTrue(
        CustomRequestHandler.getInstance().addCustomRequest.calledOnceWith(
          '123'
        )
      );
      assertChai.isTrue(
        outgoingSocketStub.send.calledOnceWith(
          JSON.stringify({ id: '123', command: 'mockCommand' })
        )
      );

      // Simulate resolution of the promise
      const resolveSpy = spy();
      CustomRequestHandler.getInstance().customRequestList['123'].promise.then(
        resolveSpy
      );
      setTimeout(() => {
        assertChai.isTrue(
          responseMock.writeHead.calledOnceWith(200, {
            'content-type': 'application/json; charset=utf-8',
            accept: 'application/json',
            'WWW-Authenticate': 'Basic realm="WS Reconnect Proxy"',
          })
        );
        assertChai.isTrue(
          responseMock.end.calledOnceWith(
            JSON.stringify({ status: 'success', value: undefined })
          )
        );
        done();
      }, 10); // Delay added to allow promise resolution
    });

    it('should handle error responses', (done) => {
      stub(CustomRequestHandler, 'getInstance').returns({
        addCustomRequest: stub().returns({
          promise: Promise.resolve(),
        }),
        customRequestList: {
          123: {
            promise: Promise.reject(),
          },
        },
      });
      // Set up request object
      requestMock.url = '/customRequest';
      requestMock.method = 'POST';

      // Stub the 'on' method to capture 'data' and 'end' event callbacks
      const requestOnStub = stub();
      requestOnStub
        .withArgs('data')
        .callsArgWith(
          1,
          JSON.stringify({ command: { id: '123', command: 'mockCommand' } })
        );
      requestOnStub.withArgs('end').callsArg(1);
      requestMock.on = requestOnStub;

      // Stub the 'send' method of the outgoing socket
      const outgoingSocketStub = {
        send: stub(),
      };

      // Stub the 'getContexts' method to return a mock context
      const getContextsStub = stub().returns(
        new Map([['mockContextId', { outgoingSocket: outgoingSocketStub }]])
      );

      // Stub the 'contexts' property of the class instance to return the mock context
      stub(proxyWsCustom, 'contexts').get(getContextsStub);
      proxyWsCustom.requestHandler(requestMock, responseMock);
      assertChai.isTrue(
        CustomRequestHandler.getInstance().addCustomRequest.calledOnceWith(
          '123'
        )
      );
      assertChai.isTrue(
        outgoingSocketStub.send.calledOnceWith(
          JSON.stringify({ id: '123', command: 'mockCommand' })
        )
      );

      // Simulate resolution of the promise
      const rejectSpy = spy();
      CustomRequestHandler.getInstance().customRequestList['123'].promise.catch(
        rejectSpy
      );
      setTimeout(() => {
        assertChai.isTrue(
          responseMock.writeHead.calledOnceWith(500, {
            'content-type': 'application/json; charset=utf-8',
            accept: 'application/json',
            'WWW-Authenticate': 'Basic realm="WS Reconnect Proxy"',
          })
        );
        assertChai.isTrue(
          responseMock.end.calledOnceWith(
            JSON.stringify({ status: 'failure', value: undefined })
          )
        );
        done();
      }, 10); // Delay added to allow promise resolution
    });

    it('catches all the errors in customRequest and returns 500', () => {
      // Set up request object for custom request
      requestMock.url = '/customRequest';
      requestMock.method = 'POST';

      // Stub the 'on' method to capture 'data' event callback and throw an error
      const requestOnStub = stub();
      requestOnStub.withArgs('data').throws(new Error('Custom error message'));
      requestMock.on = requestOnStub;

      // Call the method to test
      proxyWsCustom.requestHandler(requestMock, responseMock);

      // Assertions for the outer catch block
      assertChai.isTrue(
        responseMock.writeHead.calledOnceWith(500, {
          'content-type': 'application/json; charset=utf-8',
          accept: 'application/json',
          'WWW-Authenticate': 'Basic realm="WS Reconnect Proxy"',
        })
      );
      assertChai.isTrue(
        responseMock.end.calledOnceWith(
          JSON.stringify({ status: 'failure', value: 'Custom error message' })
        )
      );
    });
  });

  it('should handle request', () => {
    const request = {
      pipe: spy(),
      url: this.upstreamUrl + 'status',
      headers: {
        'x-connection-id': 'CONNECTION_ID',
      },
    };
    this.proxy.requestHandler(request, this.response);
    expect(this.response.writeHead.calledOnce).to.be.equal(true);
    assert(
      this.response.writeHead.calledWith(200, {
        'content-type': 'application/json; charset=utf-8',
        accept: 'application/json',
        'WWW-Authenticate': 'Basic realm="WS Reconnect Proxy"',
      })
    );
    expect(this.response.end.calledOnce).to.be.equal(true);
    assert(
      this.response.writeHead.calledWith(JSON.stringify({ status: 'Running' }))
    );
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
