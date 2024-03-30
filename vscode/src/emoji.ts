import fs from "node:fs/promises"
import path from "node:path"

let emojiCodes: Record<string, string>

export const loadEmojiCodes = async () => {
	if (!emojiCodes) {
		const filePath = path.resolve(__dirname, `../assets/emoji-code.json`)
		const data = await fs.readFile(filePath, "utf-8")
		emojiCodes = JSON.parse(data)
	}
	return emojiCodes
}

export const getEmojiCodes = () => {
	if (!emojiCodes) {
		throw new Error("Emoji codes not loaded")
	}
	return emojiCodes
}

export const getEmojiImageURL = (code: string) =>
	`https://emojiapi.dev/api/v1/${code}/64.png`

export const searchEmojiCode = (query: string) => {
	const emojiCodes = getEmojiCodes()
	const lowerQuery = query.toLowerCase()
	return Object.entries(emojiCodes).find(([key, value]) =>
		value.includes(lowerQuery)
	)?.[0]
}
