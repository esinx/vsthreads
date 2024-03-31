import fetch from "cross-fetch"

const API_ROOT = "https://api.vsthreads.tech"

type ThreadDTO = {
	_id: {
		$oid: string
	}
	reactions: Record<string, string[]>
	author: string
	profile_picture: string
	content: string
	created_at: number
	repo?: string
	subthreads?: ThreadDTO[]
}

type CreateThreadDTO = Pick<ThreadDTO, "content" | "repo">

export const createAPIClient = (args: { accessToken: string }) => {
	let { accessToken } = args
	return {
		getThread: async (id: string): Promise<ThreadDTO[]> => {
			const response = await fetch(`${API_ROOT}/threads/${id}`, {
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
			})
			if (!response.ok) {
				throw new Error("Failed to fetch thread")
			}
			return response.json()
		},
		createThread: async (
			thread: CreateThreadDTO,
			parentId?: string
		): Promise<{ _id: string }> => {
			const url = parentId
				? `${API_ROOT}/threads/${parentId}`
				: `${API_ROOT}/threads`
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify(thread),
			})
			if (!response.ok) {
				debugger
				console.error(response)
				throw new Error("Failed to create thread")
			}
			return response.json()
		},
		updateThread: async (
			threadId: string,
			reply: Pick<ThreadDTO, "content">
		) => {
			const response = await fetch(`${API_ROOT}/threads/${threadId}`, {
				method: "PATCh",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify(reply),
			})
			if (!response.ok) {
				console.error(response)
				throw new Error("Failed to edit thread")
			}
			return response.json()
		},
		deleteThread: async (threadId: string) => {
			const response = await fetch(`${API_ROOT}/threads/${threadId}`, {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
			})
			if (!response.ok) {
				console.error(response)
				throw new Error("Failed to delete thread")
			}
			return response.json()
		},
		addReaction: async (threadId: string, reaction: string) => {
			const response = await fetch(
				`${API_ROOT}/threads/${threadId}/reactions`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${accessToken}`,
					},
					body: JSON.stringify({ reaction }),
				}
			)
			if (!response.ok) {
				console.log(await response.json())
				throw new Error("Failed to add reaction")
			}
			return response.json()
		},
		removeReaction: async (threadId: string, reaction: string) => {
			const response = await fetch(
				`${API_ROOT}/threads/${threadId}/reactions`,
				{
					method: "DELETE",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${accessToken}`,
					},
					body: JSON.stringify({ reaction }),
				}
			)
			if (!response.ok) {
				console.error(response)
				throw new Error("Failed to remove reaction")
			}
			return response.json()
		},
		generate: async (input: string) => {
			const response = await fetch(`${API_ROOT}/generate`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ input }),
			})
			if (!response.ok) {
				console.error(response)
				throw new Error("Failed to generate")
			}
			return response.json()
		},
		updateToken: (token: string) => {
			accessToken = token
		},
	}
}
