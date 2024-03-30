import { spawn } from "child_process"

export const getOrigin = async (cwd: string) =>
	new Promise<string>((resolve, reject) => {
		const s = spawn("git remote get-url origin", {
			cwd,
		})
		s.on("error", reject)
		s.stdout.on("data", (data) => {
			resolve(data.toString().trim())
		})
	})
