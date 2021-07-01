const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('pino')()
const url = require('url');
const util = require('util');
const sleep = util.promisify(setTimeout);

const Queue = require('./queue');
const constants = require('./constants');

async function* retries(retryLimit, timeout) {
  for (let idx = 0; idx < retryLimit; idx++) {
    yield(idx);
    await sleep(timeout);
  }
}

class WsReconnectProxy {
  start(options) {
    if (!options.port) {
      throw new Error('No "port" passed in options!');
    }
    if (!options.target) {
      throw new Error('No "target" passed in options!');
    }
    if (!options.target.url && (!options.target.port || !options.target.host)) {
      throw new Error('"target" does not required properties!');
    }
    this.server = new WebSocket.Server({ port: options.port });
    this.target = this.getUrl(options.target);
    this.retryLimit = options.retryLimit || constants.RETRY_LIMIT;
    this.retryTimeout = options.retryTimeout || constants.RETRY_TIMEOUT;
    this.initialRetryDelay = options.initialRetryDelay || constants.INITIAL_RETRY_DELAY;
    this.proxyData = {};
    this.startListeners();
  }

  getUrl(target) {
    if(target.hasOwnProperty('url')) {
      return target.url;
    } else {
      return `ws://${target.host}:${target.port}`;
    }
  }

  getQueryString(reqUrl) {
    return url.parse(reqUrl, true).search;
  }

  async connect(wsId, target) {
    const newWS = new WebSocket(target);
    let pres;
    const fp = () => new Promise(res => {
      pres = res;
    });
    let serverUp = false;
    newWS.on('error', () => {
      pres();
    });
    newWS.on('open', () => {
      pres();
      newWS.id = uuidv4();
      this.proxyData[wsId].serverWS = newWS;
      serverUp = true;
    });
    await fp();
    return serverUp;
  }
  
  connetToUpstream(wsId, target) {
    return new Promise(async (res, rej) => {
      for await (const idx of retries(this.retryLimit, this.retryTimeout)) {
        const result = await this.connect(wsId, target);
        if (result) {
          return res();
        } else {
          logger.info(
            `Trying to form ws connection with server, retry count: ${idx}`
          );
        }
      }
      return rej();
    });
  }

  serverWsConnectionHandler(ws) {
    this.connetToUpstream(ws.id, this.proxyData[ws.id].targetEndpoint)
      .then(() => {
        logger.info('ws connection established with server');
        this.addServerListeners(
          ws, 
          this.proxyData[ws.id].serverWS, 
          this.proxyData[ws.id].targetEndpoint
        );
        this.proxyData[ws.id].serverReady = true;
        this.tryPendingClientReq(ws.id);
      })
      .catch(() => {
        logger.info('Unable to connect to server');
      });
  }

  addServerListeners(clientWs, serverWs) {
    serverWs.heartbeatPing = setInterval(() => 
      this.sendHeartbeatPing(serverWs), 
      constants.PING_INTERVAL
    );

    serverWs.on('close', (code) => {
      logger.info(`Server ws closed with code: ${code}`);
      clearInterval(serverWs.heartbeatPing);
    });
  
    serverWs.on('message', (data) => {
      if (this.proxyData[clientWs.id].clientReady) {
        while (!this.proxyData[clientWs.id].pendingServerData.isEmpty()) {
          clientWs.send(
            this.proxyData[clientWs.id].pendingServerData.dequeue()
          );
        }
        clientWs.send(data);
      } else {
        this.proxyData[clientWs.id].pendingServerData.enque(data);
      }
    });

    serverWs.on('disconnect', async (data) => {
      this.targetServerReady = false;
      this.proxyData[ws.id].serverReconnectInfo = { ...data };
      await sleep(this.initialRetryDelay);
      this.serverWsConnectionHandler(clientWs);
    });
  }

  tryPendingClientReq(wsId) {
    if (!this.proxyData[wsId].serverWS || 
      this.proxyData[wsId].serverWS.readyState !== WebSocket.OPEN) return;

    while (!this.proxyData[wsId].pendingClientData.isEmpty()) {
      this.proxyData[wsId].serverWS.send(
        this.proxyData[wsId].pendingClientData.dequeue()
      );
    }
  }

  tryPendingServerData(ws) {
    if (ws.readyState !== WebSocket.OPEN) return;

    while (!this.proxyData[ws.id].pendingServerData.isEmpty()) {
      ws.send(
        this.proxyData[ws.id].pendingServerData.dequeue()
      );
    }
  }

  sendHeartbeatPing(ws) {
    try {
      logger.info(`Sending ping for ${ws.id}`);
      ws.ping();
    } catch (error) {
      logger.info(`${ws.id} already disconnected`);
    }
  }

  checkForClientReconnection(req) {
    const reconnectInfo =  url.parse(req.url, true).query.reconnectInfo;
    return reconnectInfo ? JSON.parse(reconnectInfo) : null;
  }

  startListeners() {
    this.server.on('connection', (ws, req) => {
      const reconnectionData = this.checkForClientReconnection(req);
      if(reconnectionData) {
        ws.id = reconnectionData.id;
        this.proxyData[ws.id].clientReady = true;
        this.tryPendingServerData(ws);
        this.proxyData[ws.id].clientReconnectInfo = null;
      } else {
        ws.id = uuidv4();
        this.proxyData[ws.id] = {
          serverReady: false,
          clientReady: true,
          pendingClientData: new Queue(),
          pendingServerData: new Queue(),
          clientReconnectInfo: null,
          serverReconnectInfo: null,
          targetEndpoint: `${this.target}${this.getQueryString(req.url)}`,
        }
      }

      logger.info('new client connection');
      ws.heartbeatPing = setInterval(() => 
        this.sendHeartbeatPing(ws), 
        constants.PING_INTERVAL
      );

      this.serverWsConnectionHandler(ws);
    
      ws.on('message', (data) => {
        if (this.proxyData[ws.id].serverReady) {
          while (!this.proxyData[ws.id].pendingClientData.isEmpty()) {
            this.proxyData[ws.id].serverWS.send(
              this.proxyData[ws.id].pendingClientData.dequeue()
            );
          }
          this.proxyData[ws.id].serverWS.send(data);
        } else {
          this.proxyData[ws.id].pendingClientData.enque(data);
        }
      });

      ws.on('disconnect', (data) => {
        this.proxyData[ws.id].clientReady = false;
        this.proxyData[ws.id].clientReconnectInfo = { ...data };
      });

      ws.on('pong', () => {
        logger.info(`Received pong for : ${ws.id}`);
      });
    
      ws.on('close', (code) => {
        logger.info(`Client ws closed with ${code}`);
        clearInterval(ws.heartbeatPing);
        if (!this.proxyData.clientReconnectInfo) {
          this.proxyData[ws.id].serverWS.close();
          delete(this.proxyData[ws.id]);
        }
      });
    });
  }
}

module.exports = WsReconnectProxy;
