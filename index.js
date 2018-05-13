const url = require('url');
const { WebClient, RTMClient } = require('@slack/client');
const HttpsProxyAgent = require('https-proxy-agent');
const request = require('request');
const last = require('lodash.last');
const uniq = require('lodash.uniq');
const { YTSpace, YTToken, logLevel, proxyUrl, SLACK_BOT_TOKEN } = require("./config.js").settings;
const port = process.env.PORT || 5000;

if (process.env.HEROKU) {
	const http = require('http');

	const server = http.createServer((request, response) => {
		response.end('ok');
	});
	server.listen(port);
}

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
	return uniq(links.map(link => link.substr(1, link.length - 2)));
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

function messageForLink(linkUrl) {
	const id = parseId(linkUrl);
	return getYouTrackIssue(id)
		.then(data => {
			if (data) {
				const issueUrl = getIssueUrl(id);
				const title = encodeHTMLEntities(cutLong(data.title, 200));
				const text = encodeHTMLEntities(cutLong(cleanText(data.text), 300));

				return {
					url: issueUrl,
					text: `*[<${issueUrl}|${id}>] ${title}*\n*Создал* ${data.authorName}\n*Состояние* ${data.status}\n${text}`
				};
			}
		});
}

function parseId(linkUrl) {
	return last(url.parse(linkUrl).pathname.split('/'));
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

function getYouTrackIssue(id) {
	return new Promise(function(resolve, reject) {
		request(getYouTrackRequestOptions(id), (error, response, body) => {
			if (error) {
				reject(error);
			} else {
				if (response.statusCode === 200) {
					resolve(parseYouTrackResponse(body));
				} else {
					resolve();
				}
			}
		});
	});
}

function getYouTrackRequestOptions(id) {
	return {
		url: `https://${YTSpace}.myjetbrains.com/youtrack/rest/issue/${id}`,
		auth: {
			bearer: YTToken
		},
		headers: {
			Accept: 'application/json'
		}
	};
}

function parseYouTrackResponse(response) {
	const data = JSON.parse(response);
	const result = {};

	data['field'].forEach(({name, value}) => {
		if (name === 'summary') {
			result.title = value;
		} else if (name === 'description') {
			result.text = value;
		} else if (name === 'reporterFullName') {
			result.authorName = value;
		} else if (name === 'Состояние') {
			result.status = value[0];
		}
	});
	return result;
}
