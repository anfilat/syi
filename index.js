const url = require('url');
const slackEventsAPI = require('@slack/events-api');
const { WebClient } = require('@slack/client');
const request = require('request');
const last = require('lodash.last');
const fromPairs = require('lodash.frompairs');
const { YTSpace, YTToken, SLACK_VERIFICATION_TOKEN, SLACK_CLIENT_TOKEN } = require("./config.js").settings;
const port = process.env.PORT || 5000;

const slackEvents = slackEventsAPI.createSlackEventAdapter(SLACK_VERIFICATION_TOKEN);
const slack = new WebClient(SLACK_CLIENT_TOKEN);

slackEvents.on('link_shared', (event) => {
	const links = event.links.filter(link => checkLink(link.url));

	if (links.length) {
		Promise.all(links.map(link => messageAttachmentFromLink(link.url)))
			.then(attachments => {
				const unfurls = attachments.filter(attachment => !!attachment);
				if (unfurls.length) {
					slack.chat.unfurl({
						channel: event.channel,
						ts: event.message_ts,
						unfurls: fromPairs(unfurls)
					});
				}
			})
			.catch(console.error);
	}
});

const slackEventsErrorCodes = slackEventsAPI.errorCodes;
slackEvents.on('error', (error) => {
	if (error.code === slackEventsErrorCodes.TOKEN_VERIFICATION_FAILURE) {
		console.warn(`An unverified request was sent to the Slack events request URL: ${error.body}`);
	} else {
		console.error(error);
	}
});

slackEvents.start(port).then(() => {
	console.log(`server listening on port ${port}`);
});

function messageAttachmentFromLink(linkUrl) {
	const id = parseId(linkUrl);
	return getYouTrackIssue(id)
		.then(data => {
			if (data) {
				const issueUrl = getIssueUrl(id);
				const title = cutLong(data.title);
				const text = cutLong(cleanText(data.text), 500);

				return [
					linkUrl,
					{
						fallback: title,
						title: `[<${issueUrl}|${id}>] ${title}`,
						text,
						fields: [
							{
								title: 'Создал',
								value: data.authorName,
								short: true
							},
							{
								title: 'Состояние',
								value: data.status,
								short: true
							}
						]
					}
				];
			}
		});
}

function checkLink(linkUrl) {
	const parsedUrl = url.parse(linkUrl);
	return parsedUrl.host.indexOf(YTSpace) === 0 && parsedUrl.pathname.indexOf('/youtrack/issue/') === 0;
}

function parseId(linkUrl) {
	return last(url.parse(linkUrl).pathname.split('/'));
}

function getIssueUrl(id) {
	return `https://${YTSpace}.myjetbrains.com/youtrack/issue/${id}`;
}

function cleanText(text) {
	return text
		// удаляем неиспользуемый плейсхолдер перед текстом
		.replace(/(\|\*Ветка в GIT\*\|.*|\|\*Функциональные требования\*\|.*)/g, '')
		// удаляем [](image.png)
		.replace(/!\[]\(.*?\)/g, '')
		// убираем пустые строки
		.replace(/\n+/g, '\n')
		.trim();
}

function cutLong(str, maxLength = 200) {
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
