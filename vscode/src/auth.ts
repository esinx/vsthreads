import * as vscode from "vscode"

const GITHUB_AUTH_PROVIDER_ID = "github"
const SCOPES = ["user:email"]

export const getAuthSession = async () => {
	const session = await vscode.authentication.getSession(
		GITHUB_AUTH_PROVIDER_ID,
		SCOPES,
		{
			createIfNone: false,
		}
	)
	if (!session) {
		throw new Error("No session")
	}
	return session
}
