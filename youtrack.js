const request = require('request');
const _ = require('lodash');
const { YTSpace, YTToken } = require("./config.js").settings;

module.exports.getYouTrackIssue = getYouTrackIssue;
module.exports.getIssueUrl = getIssueUrl;

module.exports.linkRE = new RegExp(`<https://${YTSpace}.myjetbrains.com/youtrack/issue/.*?>`, 'g');

function getYouTrackIssue(id) {
	return new Promise((resolve, reject) => {
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

function getIssueUrl(id) {
	return `https://${YTSpace}.myjetbrains.com/youtrack/issue/${id}`;
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

	_.forEach(data.field, ({name, value}) => {
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
	result.comments = _.map(data.comment, ({id, authorFullName: authorName, text}) => ({id, authorName, text}));
	return result;
}
