import * as vscode from "vscode"
import { createAPIClient } from "./api"

export type State = {
	authentication?: vscode.AuthenticationSession
	activeEditor?: vscode.TextEditor
	apiClient?: ReturnType<typeof createAPIClient>
	threads: Record<string, vscode.CommentThread>
}
