'use strict';

const querystring = require('querystring');
const logger = require('./loggerFactory');
const http = require('http');
const https = require('https');
const Buffer = require('buffer');
const {
	config,
	CONNECTION_ID_HEADER,
	RECONNECT_ID_HEADER,
} = require('./constants');

function createTarget(suffixURL) {
	const url = new URL(suffixURL, config.upstream);
	return url.href;
}

function extractReconnectId(headers) {
	const { [RECONNECT_ID_HEADER]: reconnectId } = headers;
	return reconnectId;
}

function extractConnectionId(headers) {
	const { [CONNECTION_ID_HEADER]: connectionId } = headers;
	return connectionId;
}

function isReconnectHeader(headers) {
	return typeof extractReconnectId(headers) !== 'undefined';
}

const request = (options) => {
	return new Promise((resolve, reject) => {
		options.scheme = options.scheme || 'http';
		const nodeRequest =
			options.scheme === 'http' ? http.request : https.request;

		const req = nodeRequest(options, (res) => {
			const data = [];
			res.on('data', (chunk) => {
				data.push(chunk);
			});
			res.on('end', () => {
				resolve({
					statusCode: res.statusCode,
					headers: res.headers,
					data: Buffer.concat(data).toString(),
					buffer: Buffer.concat(data),
				});
			});
			res.on('error', (err) => {
				err.type = 'ResponseError';
				reject(err);
			});
		});
		req.on('error', (err) => {
			err.type = 'RequestError';
			reject(err);
		});
		if (typeof options.body !== 'undefined') {
			req.write(options.body);
		}
		req.end();
	});
};

async function sendAlert(title, subject, message) {
	const alertBodyToSend = querystring.stringify({
		people: config.alertReceivers,
		subject: subject,
		message: message,
		mobile: false,
		title,
	});
	const alertOptions = {
		method: 'POST',
		path: config.alertPath,
		hostname: config.alertHost,
		port: config.alertPort,
		body: alertBodyToSend,
		scheme: 'http',
		headers: {
			'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
			accept: 'application/json',
			'content-length': Buffer.byteLength(alertBodyToSend, 'utf-8'),
		},
	};

	try {
		const { statusCode } = await request(alertOptions);
		logger.info(
			`Sent alert to ${config.alertReceivers} with subject ${subject} status: ${statusCode}`
		);
	} catch (alertError) {
		logger.error(
			`Failed to send alert to ${config.alertReceivers} with subject ${subject}. Error: ${alertError}`
		);
	}
}

module.exports = {
	createTarget,
	extractReconnectId,
	extractConnectionId,
	isReconnectHeader,
	request,
	sendAlert,
};
