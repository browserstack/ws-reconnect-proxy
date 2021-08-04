'use strict';
const logger = require('./loggerFactory');
const packageJson = require('./package.json');
const { sendAlert } = require('./util');

class ProcessHandler {
	 onError(err) {
		const stackTrace = err.stack ? err.stack.toString() : err.toString();
		logger.error(`ERROR: ${stackTrace}`);
		
		if(process.env.NODE_ENV === 'prod'){
			const title = packageJson.name;
			const subject = `Global Exception: ${err.toString()}`;
    	const message = `Global Exception: ${err.toString} ${stackTrace}`;
			sendAlert(title, subject, message);
		}
		else{
			throw new Error(`Global Error: ${err} trace: ${err.stack}`);
		}
	}
}

module.exports = ProcessHandler;