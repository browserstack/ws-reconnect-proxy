const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('pino')()
const url = require('url');
const util = require('util');
const sleep = util.promisify(setTimeout);

const Queue = require('./queue');

class StatefulWSProxy {
  start(options) {
    this.server = new WebSocket.Server({ port: options.port });
    this.target = this.getUrl(options.target);
    this.proxyData = {};
    this.startListeners();
  }

  getUrl(target) {
    if(target.hasOwnProperty('port')) {
      return `ws://${target.host}:${target.port}`;
    } else {
      return target.url;
    }
  }

  getQueryString(reqUrl) {
    return url.parse(reqUrl, true).search;
  }

  checkServer(ws, target)  {
    if(this.proxyData[ws.id].serverReady) {
      return;
    }
    const newWS = new WebSocket(target);
    newWS.on('error', () => {
      logger.info('Trying to establish ws connection with server');
    })
    newWS.on('open', () => {
      logger.info('ws connection formed with server');
      this.proxyData[ws.id].serverWS = newWS;

      this.addServerListeners(ws, this.proxyData[ws.id].serverWS, target);
      this.proxyData[ws.id].serverReady = true;
      this.tryPendingReq(ws.id);
    });
  }

  addServerListeners(clientWs, serverWs, target) {
    serverWs.on('close', (code) => {
      logger.info(`Server ws closed with code: ${code}`);
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

    serverWs.on('disconnect', (data) => {
      this.targetServerReady = false;
      this.serverReconnectionInfo[clientWs.id] = { ...data };
      setTimeout(() => {
        setInterval(() => {
          this.checkServer(clientWs, target);
        }, 500);
      }, 1000);
    });
  }

  tryPendingReq(wsId) {
    if (!this.proxyData[wsId].serverWS || 
      this.proxyData[wsId].serverWS.readyState !== WebSocket.OPEN) return;

    while (!this.proxyData[wsId].pendingClientData.isEmpty()) {
      this.proxyData[wsId].serverWS.send(
        this.proxyData[wsId].pendingClientData.dequeue()
      );
    }
  }

  sendHeartbeatPing(ws) {
    try {
      logger.info(`Sending ping for ${ws.id}`);
      ws.ping();
    } catch (error) {
      logger.info(`${ws.id} client already disconnected`);
    }
  }

  startListeners() {
    this.server.on('connection', (ws, req) => {
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

      logger.info('new client connection');
      ws.heartbeatPing = setInterval(() => sendHeartbeatPing(ws), 30000);

      const checkServerTimer = setInterval(() => {
        this.checkServer(ws, this.proxyData[ws.id].targetEndpoint, ws.id);
      }, 1000);
    
      ws.on('message', (data) => {
        if (this.proxyData[ws.id].serverReady) {
          clearInterval(checkServerTimer);
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
    
      ws.on('close', (code) => {
        logger.info(`Socket closed with ${code}`);
        clearInterval(ws.heartbeatPing);
        clearInterval(checkServerTimer);
        this.proxyData[ws.id].serverWS.close();
        delete(this.proxyData[ws.id]);
      });
    });
  }
}

module.exports = StatefulWSProxy;
