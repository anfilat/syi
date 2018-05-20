const url = require('url');
const querystring = require('querystring');
const { WebClient, RTMClient } = require('@slack/client');
const HttpsProxyAgent = require('https-proxy-agent');
const _ = require('lodash');
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
	return _(links)
		.map(link => link.substr(1, link.length - 2))
		.uniq()
		.valueOf();
}

function getMessageForLink(linkUrl) {
	const {id, commentId} = parseLinkIds(linkUrl);
	return getYouTrackIssue(id)
		.then(data => {
			if (data) {
				return formatMessage(id, commentId, data);
			}
		});
}

function parseLinkIds(linkUrl) {
	const parsed = url.parse(linkUrl);
	const id = _.last(parsed.pathname.split('/'));
	const commentId = parsed.hash
		? querystring.parse(parsed.hash)['#comment']
		: null;

	return {id, commentId};
}

function sendMessage({url, text}, event) {
	const body = {
		text,
		channel: event.channel
	};
	if (event.thread_ts) {
		body.thread_ts = event.thread_ts;
	}

	console.log('send info for', url);
	slackWeb.chat.postMessage(body);
}
