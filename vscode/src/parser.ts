import * as vscode from "vscode"

type Comment = {
	content: string
	range: vscode.Range
}

const escapeRegExp = (text: string) => {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
}

export const parseComments =
	(languageConfig: vscode.LanguageConfiguration) =>
	(text: string): Comment[] => {
		const patterns = [
			languageConfig.comments?.lineComment &&
				`(?:\\t| )*${escapeRegExp(
					languageConfig.comments.lineComment
				)}\\s*(.*)`,
			languageConfig.comments?.blockComment &&
				`(?:\\t| )*${escapeRegExp(
					languageConfig.comments.blockComment[0]
				)}\\s*(.*)\\s*${escapeRegExp(
					languageConfig.comments.blockComment[1]
				)}\\s*`,
		]
			.filter((k) => typeof k === "string")
			.map((pattern) => new RegExp(pattern!, "gm"))
		const comments = patterns.flatMap((pattern) => {
			const matches = text.matchAll(pattern)
			return Array.from(matches, (match) => {
				const start = match.index
				const startLine = text.slice(0, start).split("\n").length - 1
				const endLine = startLine + match[0].split("\n").length - 1
				return {
					content: match[1],
					range: new vscode.Range(startLine, 0, endLine, 0),
				}
			})
		})
		return comments
	}
