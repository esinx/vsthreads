import * as vscode from "vscode"
import fs from "node:fs/promises"
import path from "node:path"

type LanguageContribution = {
	id: string
	configuration: string
}

type ExtensionPackageJSON = {
	contributes?: {
		languages: LanguageContribution[]
	}
}

export class LanguageNotSupportedError extends Error {
	constructor(languageId: string) {
		super(`Language ${languageId} not supported`)
	}
}

export const loadLanguageConfig = async (languageId: string) => {
	const extension = vscode.extensions.all.find((item) => {
		const contributions = item.packageJSON?.contributes
			?.languages as LanguageContribution[]
		return contributions?.some((contribution) => contribution.id === languageId)
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

	return languageConfig
}
