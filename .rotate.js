module.exports = {
	filter(data) {
		return data.req;
	},
	output: {
		path: './proxy.log',
		options: {
			path: './logs',
			interval: '1d',
		},
	},
};
