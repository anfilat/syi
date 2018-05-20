const log = require("loglevel");
const logPrefixer = require('loglevel-plugin-prefix');
const { logLevel } = require("./config.js");

logPrefixer.reg(log);
logPrefixer.apply(log, {
	template: '[%t]',
	timestampFormatter(date) {
		return date.toISOString();
	}
});

module.exports = {
	log,
	logLevel: logLevel || 'info'
};
