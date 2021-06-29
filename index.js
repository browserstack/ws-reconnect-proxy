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
    this.pendingReqData = {};
    this.wsData = {};
    this.serverReconnectionInfo = {};
    this.startListeners();
  }

  getUrl(target) {
    if(target.hasOwnProperty('port')) {
      return `ws://${target.host}:${target.port}`;
    } else {
      return target.url;
    }
  }

  setQueryString(reqUrl, wsId) {
    const query = url.parse(reqUrl, true).search;
    this.wsData[wsId].queryString = query;
  }

  checkServer(ws, target, timer)  {
    if(this.targetServerReady) {
      clearInterval(timer);
      return;
    }
    const newWS = new WebSocket(target);
    newWS.on('error', () => {})
    newWS.on('open', () => {
      logger.info('ws connection formed with server');
      this.wsData[ws.id].serverWS = newWS;

      this.addServerListeners(ws, this.wsData[ws.id].serverWS, target);
      clearInterval(timer);
      this.targetServerReady = true;
      tryPendingReq(ws.id);
    });
  }

  addServerListeners(clientWs, serverWs, target) {
    serverWs.on('close', (code) => {
      logger.info(`Server ws closed with code: ${code}`);
    });
  
    serverWs.on('message', (data) => {
      clientWs.send(data);
    });

    serverWs.on('disconnect', (data) => {
      this.targetServerReady = false;
      this.serverReconnectionInfo[clientWs.id] = { ...data };
      setTimeout(() => {
        const checkServerTimer = setInterval(() => {
          this.checkServer(clientWs, target, checkServerTimer);
        }, 500);
      }, 1000);
    });
  }

  tryPendingReq(wsId) {
    if (!this.wsData[wsId].serverWS || 
      this.wsData[wsId].serverWS.readyState !== WebSocket.OPEN) return;

    while (!this.pendingReqData[wsId].isEmpty()) {
      this.wsData[wsId].serverWS.send(
        this.pendingReqData[wsId].dequeue()
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
      this.targetServerReady = false;
      ws.id = uuidv4();
      this.wsData[ws.id] = {};
      this.pendingReqData[ws.id] = new Queue();
      logger.info('new client connection');
      ws.heartbeatPing = setInterval(() => sendHeartbeatPing(ws), 30000);

      this.setQueryString(req.url, ws.id);
      
      const targetEndpoint = `${this.target}${this.wsData[ws.id].queryString}`;
      const checkServerTimer = setInterval(() => {
        this.checkServer(ws, targetEndpoint, ws.id, checkServerTimer);
      }, 500);
    
      ws.on('message', async (data) => {
        if (this.targetServerReady) {
          while (!this.pendingReqData[ws.id].isEmpty()) {
            this.wsData[ws.id].serverWS.send(
              this.pendingReqData[ws.id].dequeue()
            );
          }
          this.wsData[ws.id].serverWS.send(data);
        } else {
          this.pendingReqData[ws.id].enque(data)
        }
      });
    
      ws.on('close', (code) => {
        logger.info(`Socket closed with ${code}`);
        clearInterval(ws.heartbeatPing);
        this.wsData[ws.id].serverWS.close();
        delete(this.wsData[ws.id]);
        delete(this.pendingReqData[ws.id]);
      });
    });
  }
}

module.exports = StatefulWSProxy;