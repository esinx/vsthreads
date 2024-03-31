import fs from "node:fs/promises"
import path from "node:path"

// @thread:660971f9024b900df1c439e8
let emojiCodes: Record<string, string>

export const loadEmojiCodes = async () => {
	if (!emojiCodes) {
		const filePath = path.resolve(__dirname, `../assets/emoji-code.json`)
		// @thread:660968bb7e78da10f3bc1043
		const data = await fs.readFile(filePath, "utf-8")
		emojiCodes = JSON.parse(data)
	}
	return emojiCodes
}

// @thread:66096a1801139a3d4620932d
export const getEmojiCodes = () => {
	if (!emojiCodes) {
		throw new Error("Emoji codes not loaded")
	}
	return emojiCodes
}

// @thread:66096d529831ef3bd5a2468b
export const getEmojiImageURL = (code: string) =>
	`https://emojiapi.dev/api/v1/${code}/64.png`

export const searchEmojiCode = (query: string) => {
	const emojiCodes = getEmojiCodes()
	const lowerQuery = query.toLowerCase()
	return Object.entries(emojiCodes).find(([key, value]) =>
		value.includes(lowerQuery)
	)?.[0]
}
