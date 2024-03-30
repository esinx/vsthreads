import * as vscode from "vscode"
import { parseComments } from "./parser"
import { State } from "./state"
import { getAuthSession } from "./auth"
import { randomUUID } from "crypto"
import { loadLanguageConfig } from "./language-config"
import { loadEmojiCodes } from "./emoji"

let state: State = {
	threads: {},
	activeEditor: vscode.window.activeTextEditor,
}

namespace vsthread {
	export type Thread = {
		id: string
		parent: vscode.CommentThread
	} & vscode.Comment
}

const getLanguageConfig = (() => {
	const languageConfigCache: Map<string, vscode.LanguageConfiguration> =
		new Map()
	return async (languageId: string) => {
		if (languageConfigCache.has(languageId)) {
			return languageConfigCache.get(languageId)!
		}
		const languageConfig = await loadLanguageConfig(languageId)
		languageConfigCache.set(languageId, languageConfig)
		return languageConfig
	}
})()

const authenticate = async () => {
	const session = await getAuthSession()
	state = {
		...state,
		authentication: session,
	}
}

export function activate(context: vscode.ExtensionContext) {
	if (!state.activeEditor) {
		return
	}
	const commentController = vscode.comments.createCommentController(
		"vsthreads",
		"vsthreads"
	)
	commentController.options = {
		prompt: "🧵 Leave a reply on this thread",
	}

	context.subscriptions.push(commentController)
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"vsthreads.createThread",
			async (reply: vscode.CommentReply) => {
				console.log(`[DEBUG]: ${state.authentication}`)
				if (!state.activeEditor) {
					return
				}
				console.log(`[createThread]`, reply)
				const threadId = randomUUID()
				const languageConfig = await getLanguageConfig(
					state.activeEditor.document.languageId
				)
				if (typeof languageConfig.comments?.lineComment !== "undefined") {
					const lineComment = languageConfig.comments.lineComment
					await state.activeEditor.edit((editBuilder) => {
						editBuilder.insert(
							new vscode.Position(reply.thread.range.start.line, 0),
							`${lineComment} @thread:${threadId}\n`
						)
					})
				} else if (
					typeof languageConfig.comments?.blockComment !== "undefined"
				) {
					const [start, end] = languageConfig.comments.blockComment
					await state.activeEditor.edit((editBuilder) => {
						editBuilder.insert(
							new vscode.Position(reply.thread.range.start.line, 0),
							`${start} @thread:${threadId} ${end}\n`
						)
					})
				} else {
					await vscode.window.showErrorMessage(
						"Language does not support comments"
					)
				}
				reply.thread.dispose()
			}
		)
	)

	context.subscriptions.push(
		vscode.commands.registerCommand(
			"vsthreads.replyThread",
			(reply: vscode.CommentReply) => {
				console.log(`[replyThread]`, reply)
			}
		)
	)

	context.subscriptions.push(
		vscode.commands.registerCommand(
			"vsthreads.editThread",
			(comment: vsthread.Thread) => {
				comment.parent.comments = (
					comment.parent.comments as vsthread.Thread[]
				).map((t) => ({
					...t,
					mode: t.id === comment.id ? vscode.CommentMode.Editing : t.mode,
				}))
			}
		)
	)

	context.subscriptions.push(
		vscode.commands.registerCommand(
			"vsthreads.saveThread",
			(reply: vscode.CommentReply) => {
				console.log(`[saveThread]`, reply)
			}
		)
	)

	context.subscriptions.push(
		vscode.commands.registerCommand(
			"vsthreads.deleteThread",
			(reply: vscode.CommentReply) => {
				console.log(`[deleteThread]`, reply)
			}
		)
	)

	commentController.commentingRangeProvider = {
		// exclude comments from commenting ranges
		provideCommentingRanges: async (document, token) => {
			const languageConfig = await getLanguageConfig(document.languageId)
			const editorText = document.getText()
			const commentParser = parseComments(languageConfig)
			const comments = await commentParser(editorText)
			const lineCount = document.lineCount
			const commentRanges = comments.map((comment) => comment.range)
			const nonCommentRanges = []
			let startLine = 0
			for (const commentRange of commentRanges) {
				const endLine = commentRange.start.line
				if (startLine !== endLine) {
					nonCommentRanges.push(new vscode.Range(startLine, 0, endLine, 0))
				}
				startLine = commentRange.end.line
			}
			if (startLine < lineCount) {
				nonCommentRanges.push(new vscode.Range(startLine, 0, lineCount - 1, 0))
			}
			return nonCommentRanges
		},
	} satisfies vscode.CommentingRangeProvider

	const renderComments = async () => {
		if (!state.activeEditor) {
			return
		}
		const activeEditor = state.activeEditor
		await loadEmojiCodes()
		const languageConfig = await getLanguageConfig(
			activeEditor.document.languageId
		)
		const editorText = activeEditor.document.getText()
		const commentParser = parseComments(languageConfig)
		const comments = commentParser(editorText)
		const removedThreads = new Set(Object.keys(state.threads))
		comments.forEach((comment) => {
			const match = comment.content.match(/@thread:(.+)/)
			if (!match) {
				return
			}
			const threadId = match[1]
			if (typeof state.threads[threadId] === "undefined") {
				const thread = commentController.createCommentThread(
					vscode.Uri.file(activeEditor.document.fileName),
					new vscode.Range(
						comment.range.start.line,
						0,
						comment.range.start.line,
						0
					),
					[]
				)
				const comments: vsthread.Thread[] = [
					{
						id: threadId,
						author: { name: "vscode" },
						body: new vscode.MarkdownString(comment.content),
						mode: vscode.CommentMode.Preview,
						contextValue: "by-user",
						label: "comment",
						reactions: [],
						timestamp: new Date(),
						parent: thread,
					},
					{
						id: `${threadId}-2`,
						author: { name: "vscode" },
						body: new vscode.MarkdownString(comment.content),
						mode: vscode.CommentMode.Preview,
						contextValue: "none",
						label: "comment-2",
						reactions: [],
						timestamp: new Date(),
						parent: thread,
					},
				]
				thread.comments = comments
				state.threads = {
					...state.threads,
					[threadId]: thread,
				}
			}
			removedThreads.delete(threadId)
		})
		removedThreads.forEach((threadId) => {
			state.threads[threadId].dispose()
			state.threads = Object.fromEntries(
				Object.entries(state.threads).filter(([id]) => id !== threadId)
			)
		})
	}
	vscode.workspace.onDidChangeTextDocument(
		async (event) => renderComments(),
		null,
		context.subscriptions
	)

	authenticate()
	loadEmojiCodes()
	renderComments()
}
