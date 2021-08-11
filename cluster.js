'use strict';

const cluster = require('cluster');
const { config } = require('./lib/config/constants.js');
const { watch } = require('fs');
const logger = require('./lib/util/loggerFactory.js');
const Proxy = require('./lib/core/Proxy.js');
const ProcessHandler = require('./lib/util/ProcessHandler.js');

const WORKER_CNT = config.workerVal;
const activeWorkers = [];

function forceKill(worker) {
	if (!worker.isDead()) {
		logger.info(`Worker ${worker.process.pid} is ${worker.state}, Killing it`);
		worker.kill('SIGUSR2');
	}
}

function disconnectOldWorkers() {
	const len = activeWorkers.length;
	for (let i = 0; i < len; i++) {
		const oldWorker = activeWorkers.shift();
		oldWorker.disconnect();
		setTimeout(() => forceKill(oldWorker), config.workerKillTimer);
	}
}

function spawnNewWorkers() {
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
}

if (cluster.isMaster) {
	cluster.on('online', function (worker) {
		logger.info(`Worker ${worker.process.pid} is online`);
	});

	cluster.on('exit', (worker, code, signal) => {
		logger.info(
			`worker ${worker.process.pid} died with signal ${signal} code ${code}`
		);
		if (activeWorkers.length == 0) spawnNewWorkers();
	});

	spawnNewWorkers();

	let currTime = Date.now();
	watch('tmp/restart.txt', () => {
		if (Date.now() > currTime) {
			currTime = Date.now();
			disconnectOldWorkers();
			spawnNewWorkers();
		}
	});
} else {
	new Proxy();
}

process.on('uncaughtException', new ProcessHandler().onError);
