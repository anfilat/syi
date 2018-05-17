const url = require('url');
const querystring = require('querystring');
const { WebClient, RTMClient } = require('@slack/client');
const HttpsProxyAgent = require('https-proxy-agent');
const last = require('lodash.last');
const map = require('lodash.map');
const uniq = require('lodash.uniq');
const { getYouTrackIssue, linkRE } = require('./youtrack');
const formatMessage = require('./formatMessage');
const { logLevel, proxyUrl, SLACK_BOT_TOKEN } = require("./config.js").settings;

// Web API connector
const slackWeb = new WebClient(SLACK_BOT_TOKEN);

// RTM API connector
const rtmOptions = {
	logLevel: logLevel || 'info'
};

if (proxyUrl) {
	rtmOptions.agent = new HttpsProxyAgent(proxyUrl);
}

const rtm = new RTMClient(SLACK_BOT_TOKEN, rtmOptions);
rtm.start();

rtm.on('message', (event) => {
	if (event.subtype) {
		return;
	}

	let links = parseLinks(event.text);
	if (links.length) {
		Promise.all(links.map(getMessageForLink))
			.then(messages => {
				messages
					.filter(message => !!message)
					.forEach(message => sendMessage(message, event));
			})
			.catch(console.error);
	}
});

function parseLinks(text) {
	let links = text.match(linkRE);
	return uniq(map(links, link => link.substr(1, link.length - 2)));
}

function getMessageForLink(linkUrl) {
	const {id, commentId} = parseIds(linkUrl);
	return getYouTrackIssue(id)
		.then(data => {
			if (data) {
				return formatMessage(id, commentId, data);
			}
		});
}

function parseIds(linkUrl) {
	const parsed = url.parse(linkUrl);
	const id = last(parsed.pathname.split('/'));
	let commentId = null;
	if (parsed.hash) {
		commentId = querystring.parse(parsed.hash)['#comment'];
	}
	return {id, commentId};
}

function sendMessage({url, text}, event) {
	console.log('send info for', url);
	const body = {
		text,
		channel: event.channel
	};
	if (event.thread_ts) {
		body.thread_ts = event.thread_ts;
	}
	slackWeb.chat.postMessage(body);
}
