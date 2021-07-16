'use strict';

const EventEmitter = require('events');
const IncomingWebSocket = require('./IncomingWebSocket.js');

class Context extends EventEmitter {
  constructor(connectionId) {
    this.connectionId = connectionId;
    this.incomingSocket = null;
    this.outgoingSocket = null;
    this.reconnectData = null;
    this.incomingLock = true;
  }

  addNewIncomingConnection(socket, request) {
    const prevNull = this.incomingSocket === null;
    this.incomingSocket = new IncomingWebSocket(socket, request);
    if (prevNull) {
      this.incomingSocket.emit('kStartConnection');
    }
  }

  incomingListener() {
    this.incomingSocket.on('kMessageReceived', msg => {
      if (this.incomingLock)
        this.incomingSocket.addToQueue(msg);
      else
        this.outgoingSocket.emit('kSendMessage', msg);
    });

    this.incomingSocket.on('kReconnect', () => {
      clearTimeout(this.upstreamCloseTimer);
      this.upstreamCloseTimer = null;
    });

    this.incomingSocket.on('kDrainMessage', msg => {
      this.outgoingSocket.emit('kDrainedMessage', msg);
    });

    this.incomingSocket.on('kClientClosed', (code, msg) => {
      this.upstreamCloseTimer = setTimeout(() => {
        this.outgoingSocket.close();
      }, UPSTREAM_DELAY);
    });
  }

  outgoingListeners() {
    this.outgoingSocket.on('kMessageReceived', msg => {
      if (this.outgoingLock)
        this.outgoingSocket.addToQueue(msg);
      else
        this.incomingSocket.emit('kSendMessage', msg);
    });

    this.outgoingSocket.on('kDrainMessage', msg => {
      this.incomingSocket.emit('kDrainedMessage', msg);
    });

    this.outgoingSocket.on('kUpstreamClosed', (code, msg) => {
      this.incomingSocket.close();
    });

    this.outgoingSocket.on('kUpstreamRestarted', (code, msg) => {
      this.enableIncomingLock();
    });
  }

  enableIncomingLock() {
    this.incomingLock = true;
  }

  updateReconnect(data) {
    this.reconnectData = data;
  }

  updateConnectionId(connectionId) {
    this.connectionId = connectionId;
  }

  updateOutgoingSocket(socket) {
    this.outgoingSocket = socket;
  }
};

module.exports = Context;
