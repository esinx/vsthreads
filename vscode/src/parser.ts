import * as vscode from "vscode"
import fs from "node:fs/promises"
import path from "node:path"

type Comment = {
	content: string
	range: vscode.Range
}

type LanguageContribution = {
	id: string
	configuration: string
}

type ExtensionPackageJSON = {
	contributes?: {
		languages: LanguageContribution[]
	}
}

const escapeRegExp = (text: string) => {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
}

export class LanguageNotSupportedError extends Error {
	constructor(languageId: string) {
		super(`Language ${languageId} not supported`)
	}
}

export const parseComments =
	(languageId: string) =>
	async (text: string): Promise<Comment[]> => {
		const extension = vscode.extensions.all.find((item) => {
			const contributions = item.packageJSON?.contributes
				?.languages as LanguageContribution[]
			return contributions?.some(
				(contribution) => contribution.id === languageId
			)
		})
		if (!extension) {
			throw new LanguageNotSupportedError(languageId)
		}

		const packageJSON = extension.packageJSON as ExtensionPackageJSON
		const languageConfigPath = packageJSON.contributes?.languages.find(
			(language) => language.id === languageId
		)!.configuration!
		// ^ literally impossible to be undefined
		// forgive me god of typescript for my sins of forced optional unwrapping

		const languageConfigContents = await fs.readFile(
			path.resolve(extension.extensionPath, languageConfigPath),
			"utf-8"
		)

		const languageConfig = JSON.parse(
			languageConfigContents
		) as vscode.LanguageConfiguration

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
			.map((pattern) => new RegExp(pattern, "gm"))

		const comments = patterns.flatMap((pattern) => {
			const matches = text.matchAll(pattern)
			return Array.from(matches, (match) => {
				const start = match.index
				const startLine = text.slice(0, start).split("\n").length - 1
				return {
					content: match[1],
					range: new vscode.Range(startLine, 0, startLine, 0),
				}
			})
		})

		return comments
	}
