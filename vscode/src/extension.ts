import * as vscode from "vscode"
import { parseComments } from "./parser"

let threads: Record<string, vscode.CommentThread> = {}

class Thread implements vscode.Comment {
	id: string
	label: string
	body: string | vscode.MarkdownString = new vscode.MarkdownString(`
	\`\`\`typescript
   const parser = parseComments(activeEditor.document.languageId)
	\`\`\`
   `)

	mode: vscode.CommentMode = vscode.CommentMode.Preview
	author: vscode.CommentAuthorInformation = {
		name: "VS Threads",
	}
	constructor(id: string) {
		this.id = id
		this.label = `@thread:${id}`
	}
}

export function activate(context: vscode.ExtensionContext) {
	if (!vscode.window.activeTextEditor) {
		return
	}
	const activeEditor = vscode.window.activeTextEditor
	const commentController = vscode.comments.createCommentController(
		"vsthreads",
		"vsthreads"
	)
	context.subscriptions.push(commentController)

	commentController.commentingRangeProvider = {
		provideCommentingRanges: (document, token) => {
			const lineCount = document.lineCount
			return [new vscode.Range(0, 0, lineCount - 1, 0)]
		},
	} satisfies vscode.CommentingRangeProvider
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"vsthreads.createThread",
			(reply: vscode.CommentReply) => {}
		)
	)

	const parser = parseComments(activeEditor.document.languageId)

	const renderComments = async () => {
		const editorText = activeEditor.document.getText()
		const comments = await parser(editorText)
		let removedThreads = new Set(Object.keys(threads))
		comments.forEach((comment) => {
			const match = comment.content.match(/@thread:(.+)/)
			if (!match) {
				return
			}
			const threadId = match[1]
			if (!threads[threadId]) {
				const thread = commentController.createCommentThread(
					vscode.Uri.file(activeEditor.document.fileName),
					comment.range,
					[]
				)
				thread.comments = [new Thread(threadId)]
				threads[threadId] = thread
			}
			removedThreads.delete(threadId)
		})
		removedThreads.forEach((threadId) => {
			threads[threadId].dispose()
			threads = Object.fromEntries(
				Object.entries(threads).filter(([id]) => id !== threadId)
			)
		})
	}

	vscode.workspace.onDidChangeTextDocument(
		async (event) => renderComments(),
		null,
		context.subscriptions
	)

	renderComments()
}
