import * as vscode from "vscode"
import { parseComments } from "./parser"
import { State } from "./state"
import { getAuthSession } from "./auth"
import { loadLanguageConfig } from "./language-config"
import { getEmojiImageURL, loadEmojiCodes, searchEmojiCode } from "./emoji"
import { createAPIClient } from "./api"
import { getOrigin } from "./git"
import path from "node:path"

const REACTIONS = [
	["heart", "red_heart"],
	["bad", "pile_of_poo"],
	["laugh", "laughing"],
	["confused", "confused"],
	["rocket", "rocket"],
	["eyes", "eyes"],
]

let state: State = {
	threads: {},
	activeEditor: vscode.window.activeTextEditor,
}

namespace vsthread {
	export type Thread = {
		id: string
		parent: vscode.CommentThread
		timestamp: Date
		root?: boolean
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
	const apiClient = createAPIClient({ accessToken: session.accessToken })
	state = {
		...state,
		authentication: session,
		apiClient,
	}
}

export function activate(context: vscode.ExtensionContext) {
	state = {
		...state,
		activeEditor: vscode.window.activeTextEditor,
	}
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
	commentController.reactionHandler = async (element, reaction) => {
		const e = element as vsthread.Thread
		if (!state.apiClient) {
			return
		}
		const threadId = e.id
		if (
			element.reactions?.find((r) => r.label === reaction.label)
				?.authorHasReacted
		) {
			console.log("remove reaction", reaction.label)
			await state.apiClient.removeReaction(threadId, reaction.label)
		} else {
			console.log("add reaction", reaction.label)
			await state.apiClient.addReaction(threadId, reaction.label)
		}

		if (element.reactions) {
			element.reactions = element.reactions.map((r) => {
				if (r.label === reaction.label) {
					return {
						...r,
						count: r.authorHasReacted ? r.count - 1 : r.count + 1,
						authorHasReacted: !r.authorHasReacted,
					}
				}
				return r
			})
		}

		Object.entries(state.threads).forEach(([, thread]) => {
			thread.dispose()
		})

		state.threads = {}
		renderComments()
	}
	context.subscriptions.push(commentController)
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"vsthreads.createThread",
			async (reply: vscode.CommentReply) => {
				try {
					if (!state.activeEditor || !state.apiClient) {
						return
					}
					const origin = await getOrigin(
						path.dirname(state.activeEditor.document.uri.fsPath)
					)
					const { _id: threadId } = await state.apiClient.createThread({
						repo: origin,
						content: reply.text,
					})
					console.log(`[createThread]`, threadId)
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
					renderComments()
				} catch (e) {
					console.error(e)
				}
			}
		)
	)
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"vsthreads.replyThread",
			async (reply: vscode.CommentReply) => {
				if (!state.apiClient) {
					return
				}
				const rootThread = (reply.thread.comments as vsthread.Thread[]).find(
					(comment) => comment.root
				)
				if (!rootThread) {
					return
				}
				const res = await state.apiClient.createThread(
					{
						content: reply.text,
					},
					rootThread.id
				)
				reply.thread.dispose()
				state.threads = Object.fromEntries(
					Object.entries(state.threads).filter(([id]) => id !== rootThread.id)
				)
				setTimeout(() => {
					renderComments()
				})
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
			"vsthreads.deleteThread",
			(reply: vsthread.Thread) => {
				if (!state.apiClient) {
					return
				}
				state.apiClient.deleteThread(reply.id)
				reply.parent.comments = (
					reply.parent.comments as vsthread.Thread[]
				).filter((t) => t.id !== reply.id)

				state.threads = Object.fromEntries(
					Object.entries(state.threads).filter(([id]) => id !== reply.id)
				)

				renderComments()
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
		if (!state.activeEditor || !state.apiClient) {
			return
		}
		const activeEditor = state.activeEditor
		const apiClient = state.apiClient
		await loadEmojiCodes()
		const languageConfig = await getLanguageConfig(
			activeEditor.document.languageId
		)
		const editorText = activeEditor.document.getText()
		const commentParser = parseComments(languageConfig)
		const comments = commentParser(editorText)
		const removedThreads = new Set(Object.keys(state.threads))

		const commentContent = await Promise.all(
			comments.map(async (c) => {
				const match = c.content.match(/@thread:(.+)/)
				if (!match) {
					return null
				}
				const threadId = match[1]
				const res = await apiClient.getThread(threadId)
				const thread = res[0]
				return {
					...c,
					...thread,
					id: threadId,
				}
			})
		)

		commentContent
			.filter((c) => c !== null)
			.forEach((thread) => {
				if (!thread) {
					return
				}
				if (typeof state.threads[thread.id] === "undefined") {
					console.log("reactions", thread.reactions)
					const createdThread = commentController.createCommentThread(
						vscode.Uri.file(activeEditor.document.fileName),
						new vscode.Range(
							thread.range.start.line,
							0,
							thread.range.start.line,
							0
						),
						[]
					)
					const comments: vsthread.Thread[] = [
						{
							id: thread.id,
							author: {
								name: thread.author,
								iconPath: vscode.Uri.parse(thread.profile_picture),
							},
							body: new vscode.MarkdownString(thread.content),
							mode: vscode.CommentMode.Preview,
							contextValue:
								thread.author === state.authentication?.account.label
									? "by-user"
									: "by-others",
							label: "comment",
							reactions: REACTIONS.map(([label, emoji]) => ({
								label,
								count: thread.reactions[label]?.length || 0,
								authorHasReacted: state.authentication?.account.label
									? thread.reactions[label]?.includes(
											state.authentication.account.label
									  )
									: false,
								iconPath: vscode.Uri.parse(
									getEmojiImageURL(searchEmojiCode(emoji)!)
								),
							})),
							timestamp: new Date(thread.created_at * 1000),
							parent: createdThread,
							root: true,
						},
						...(thread.subthreads?.map((subthread) => ({
							id: subthread._id.$oid,
							author: {
								name: subthread.author,
								iconPath: vscode.Uri.parse(subthread.profile_picture),
							},
							body: new vscode.MarkdownString(subthread.content),
							mode: vscode.CommentMode.Preview,
							timestamp: new Date(subthread.created_at * 1000),
							contextValue:
								subthread.author === state.authentication?.account.label
									? "by-user"
									: "by-others",
							label: "comment",
							parent: createdThread,
							reactions: REACTIONS.map(([label, emoji]) => ({
								label,
								count: thread.reactions[label]?.length || 0,
								authorHasReacted: state.authentication?.account.label
									? thread.reactions[label]?.includes(
											state.authentication.account.label
									  )
									: false,
								iconPath: vscode.Uri.parse(
									getEmojiImageURL(searchEmojiCode(emoji)!)
								),
							})),
						})) ?? []),
					].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

					createdThread.comments = comments
					state.threads = {
						...state.threads,
						[thread.id]: createdThread,
					}
				}
				removedThreads.delete(thread.id)
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
