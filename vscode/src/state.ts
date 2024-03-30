import * as vscode from "vscode"

export type State = {
	authentication?: vscode.AuthenticationSession
	activeEditor?: vscode.TextEditor
	threads: Record<string, vscode.CommentThread>
}
