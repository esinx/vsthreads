import fetch from "cross-fetch"

const API_ROOT = "http://localhost:8000/"

type ThreadDTO = {
	_id: string
	content: string
	repo?: string
	subthreads?: ThreadDTO[]
}

type CreateThreadDTO = Pick<ThreadDTO, "content" | "repo">

export const createAPIClient = (args: { accessToken: string }) => {
	let { accessToken } = args
	return {
		getThread: async (id: string) => {
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
		): Promise<ThreadDTO> => {
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
				throw new Error("Failed to remove reaction")
			}
			return response.json()
		},
		updateToken: (token: string) => {
			accessToken = token
		},
	}
}
