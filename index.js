const url = require('url');
const querystring = require('querystring');
const { WebClient, RTMClient } = require('@slack/client');
const HttpsProxyAgent = require('https-proxy-agent');
const last = require('lodash.last');
const map = require('lodash.map');
const uniq = require('lodash.uniq');
const getYouTrackIssue = require('./youtrack');
const { YTSpace, logLevel, proxyUrl, SLACK_BOT_TOKEN } = require("./config.js").settings;

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
		Promise.all(links.map(messageForLink))
			.then(messages => {
				messages
					.filter(message => !!message)
					.forEach(message => sendMessage(message, event));
			})
			.catch(console.error);
	}
});

const linkRE = new RegExp(`<https://${YTSpace}.myjetbrains.com/youtrack/issue/.*?>`, 'g');

function parseLinks(text) {
	let links = text.match(linkRE);
	return uniq(map(links, link => link.substr(1, link.length - 2)));
}

function sendMessage({url, text}, event) {
	console.error('send info for', url);
	const body = {
		text,
		channel: event.channel
	};
	if (event.thread_ts) {
		body.thread_ts = event.thread_ts;
	}
	slackWeb.chat.postMessage(body);
}

function messageForLink(linkUrl) {
	const {id, commentId} = parseIds(linkUrl);
	return getYouTrackIssue(id)
		.then(data => {
			if (data) {
				const issueUrl = getIssueUrl(id);
				const title = encodeHTMLEntities(cutLong(data.title, 200));
				const body = encodeHTMLEntities(cutLong(cleanText(data.text), 300));

				let text = `*[<${issueUrl}|${id}>] ${title}*\n`;
				text += `*Создал* ${data.authorName}\n`;
				text += `*Состояние* ${data.status}\n`;
				text += body;

				if (commentId) {
					const comment = data.comments.find(({id}) => id === commentId);
					if (comment) {
						const commentBody = encodeHTMLEntities(cutLong(cleanText(comment.text), 300));

						text += `*Комментарий* ${comment.authorName}\n`;
						text += commentBody;
					}
				}

				return {
					url: issueUrl,
					text
				};
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

function getIssueUrl(id) {
	return `https://${YTSpace}.myjetbrains.com/youtrack/issue/${id}`;
}

// удаляем неиспользуемый плейсхолдер перед текстом
const placeholderRE = new RegExp(/(\|\*Ветка в GIT\*\|.*|\|\*Функциональные требования\*\|.*)/g);
// удаляем [](image.png)
const imageRE = new RegExp(/!\[]\(.*?\)/g);
// убираем пустые строки
const doubleEmptyLinesRE = new RegExp(/\n+/g);

function cleanText(text) {
	return text
		.replace(placeholderRE, '')
		.replace(imageRE, '')
		.replace(doubleEmptyLinesRE, '\n')
		.trim();
}

function encodeHTMLEntities(text) {
	return text
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/&/g, '&amp;')
}

function cutLong(str, maxLength) {
	if (str.length > maxLength) {
		return str.substr(0, maxLength) + '...';
	}
	return str;
}
