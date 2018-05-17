const { getIssueUrl } = require('./youtrack');

module.exports = formatMessage;

function formatMessage(id, commentId, data) {
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
