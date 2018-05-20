const { getIssueUrl } = require('./youtrack');

module.exports = formatMessage;

function formatMessage(id, commentId, data) {
	const issueUrl = getIssueUrl(id);
	const title = encodeHTMLEntities(cutLong(normalizeString(data.title), 200, 30));
	const authorName = normalizeString(data.authorName);
	const status = normalizeString(data.status);
	const body = encodeHTMLEntities(cutLong(cleanText(normalizeString(data.text)), 300, 50));

	let text = `*[<${issueUrl}|${id}>] ${title}*\n`;
	text += `*Создал* ${authorName}\n`;
	text += `*Состояние* ${status}\n`;
	text += body;

	if (commentId) {
		const comment = data.comments.find(({id}) => id === commentId);
		if (comment) {
			const commentBody = encodeHTMLEntities(cutLong(cleanText(normalizeString(comment.text)), 300, 50));
			const authorName = normalizeString(comment.authorName);

			text += `\n*Комментарий* ${authorName}\n`;
			text += commentBody;
		}
	}

	return {
		url: issueUrl,
		text
	};
}

function normalizeString(text) {
	return String(text || '').trim();
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

const spaceRE = /\s/;

function cutLong(str, maxLength, pad) {
	if (str.length > maxLength) {
		const spacePosition = str.substr(maxLength, pad).search(spaceRE);
		const position = maxLength + (spacePosition === -1 ? 0 : spacePosition);
		return str.substr(0, position) + '...';
	}
	return str;
}
