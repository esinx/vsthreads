import { exec, spawn } from "child_process"

export const getOrigin = async (cwd: string) =>
	new Promise<string>((resolve, reject) => {
		const s = exec(
			"git remote get-url origin",
			{
				cwd,
			},
			(error, stdout, stderr) => {
				if (error) {
					reject(error)
				} else {
					resolve(stdout.trim())
				}
			}
		)
	})
