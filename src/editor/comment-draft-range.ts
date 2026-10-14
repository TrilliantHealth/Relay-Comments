export interface CommentDraftRange {
	from: number;
	to: number;
}

function blockPrefixLength(line: string): number {
	let cursor = /^[ \t]*/.exec(line)![0].length;
	let hasPrefix = false;
	while (cursor < line.length) {
		const quote = /^>[ \t]*/.exec(line.slice(cursor));
		const list = /^(?:[-+*]|\d{1,9}[.)])[ \t]+/.exec(line.slice(cursor));
		const marker = quote ?? list;
		if (!marker) break;
		if (list && /^(?:\*[ \t]*){3,}$|^(?:-[ \t]*){3,}$/.test(line.slice(cursor))) break;
		cursor += marker[0].length;
		hasPrefix = true;
		if (list) {
			cursor += /^\[[ xX]\][ \t]+/.exec(line.slice(cursor))?.[0].length ?? 0;
		}
	}
	const heading = /^#{1,6}[ \t]+/.exec(line.slice(cursor));
	if (heading) {
		cursor += heading[0].length;
		hasPrefix = true;
	}
	return hasPrefix ? cursor : 0;
}

function insideFence(documentText: string, lineFrom: number): boolean {
	let fence: { marker: string; length: number } | null = null;
	for (const line of documentText.slice(0, lineFrom).split("\n")) {
		const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
		if (!match) continue;
		if (fence) {
			if (match[1][0] === fence.marker && match[1].length >= fence.length && !match[2].trim()) {
				fence = null;
			}
		} else if (match[1][0] !== "`" || !match[2].includes("`")) {
			fence = { marker: match[1][0], length: match[1].length };
		}
	}
	return fence !== null;
}

/** Null means a prefixed selection crosses lines or contains only block syntax. */
export function commentDraftContentRange(
	documentText: string,
	from: number,
	to: number,
): CommentDraftRange | null {
	if (from === to) return { from, to };
	const lineFrom = documentText.lastIndexOf("\n", from - 1) + 1;
	const newline = documentText.indexOf("\n", from);
	const lineTo = newline < 0 ? documentText.length : newline;
	const line = documentText.slice(lineFrom, lineTo).replace(/\r$/, "");
	const prefixLength = blockPrefixLength(line);
	if (!prefixLength || insideFence(documentText, lineFrom)) return { from, to };
	// Triple-click includes the line break. Keep review markup before it.
	if (to > lineTo + (newline < 0 ? 0 : 1)) return null;
	const contentFrom = Math.max(from, lineFrom + prefixLength);
	let contentTo = Math.min(to, lineFrom + line.length);
	if (/#{1,6}[ \t]+$/.test(line.slice(0, prefixLength))) {
		const closing = /[ \t]+#+[ \t]*$/.exec(line);
		if (closing) contentTo = Math.min(contentTo, lineFrom + closing.index);
	}
	return contentFrom < contentTo ? { from: contentFrom, to: contentTo } : null;
}
