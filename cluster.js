'use strict';

const cluster = require('cluster');
const { watch, fstat, existsSync } = require('fs');
const path = require('path');

const codeDir = process.env.CODE_DIR || path.join(__dirname, '/');
const { config } = require(path.join(codeDir, 'lib/config/constants.js'));
const logger = require(path.join(codeDir, 'lib/util/loggerFactory.js'));
const Proxy = require(path.join(codeDir, 'lib/core/Proxy.js'));

const WORKER_CNT = config.workerVal;
const activeWorkers = [];

const RESTART_FILE = path.join(codeDir, 'tmp/restart.txt');
const STOP_FILE = path.join(codeDir, 'tmp/stop.txt');
let stopCalled = false;

const forceKill = (worker) => {
  if (!worker.isDead()) {
    logger.info(`Worker ${worker.process.pid} is ${worker.state}, Killing it`);
    worker.kill('SIGUSR2');
  }
};

const disconnectOldWorkers = () => {
  const len = activeWorkers.length;
  for (let i = 0; i < len; i++) {
    const oldWorker = activeWorkers.shift();
    oldWorker.disconnect();
    setTimeout(() => forceKill(oldWorker), config.workerKillTimer);
  }
};

const spawnNewWorkers = () => {
  if (cluster.isMaster) {
    for (let i = 0; i < WORKER_CNT; ++i) {
      const worker = cluster.fork();
      worker.on('error', (err) => {
        logger.error(`Received error event on ${worker.id} : ${err}`);
      });
      logger.info(`Created worker with id ${worker.id}`);
      activeWorkers.push(worker);
    }
  }
};

if (cluster.isMaster) {
  cluster.on('online', function (worker) {
    logger.info(`Worker ${worker.process.pid} is online`);
  });

  cluster.on('exit', (worker, code, signal) => {
    logger.info(
      `worker ${worker.process.pid} died with signal ${signal} code ${code}`
    );
    if (stopCalled) {
      if (activeWorkers.length == 0) {
        logger.info(
          `All workers stopped. Exiting master process ${process.pid}`
        );
        process.exit(0);
      }
    }
    if (activeWorkers.length == 0 && !stopCalled) spawnNewWorkers();
  });

  spawnNewWorkers();

  let currTime = Date.now();
  watch(RESTART_FILE, () => {
    if (Date.now() > currTime) {
      currTime = Date.now();
      disconnectOldWorkers();
      spawnNewWorkers();
    }
  });
  if (existsSync(STOP_FILE)) {
    watch(STOP_FILE, () => {
      logger.info(`Stopping cluster gracefully`)
      stopCalled = true;
      if (Date.now() > currTime) {
        currTime = Date.now();
        disconnectOldWorkers();
      }
    });
  } else {
    logger.info('Graceful stop is not enabled')
  }
} else {
  const proxy = new Proxy();
  cluster.worker.on('disconnect', () => {
    proxy.httpServer.close(() => {
      logger.info(`Worker stopping ${process.pid}`);
      process.exit(0);
    });
  });
}
