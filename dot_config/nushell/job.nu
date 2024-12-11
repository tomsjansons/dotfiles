# based on: https://github.com/nushell/nu_scripts/blob/main/background_task/job.nu

# nu version independent `view-source`
def get_source_code [block] {
	if ((nu --version | split row '.').1 | into int) >= 76 {
		view source $block
	} else {
		view-source $block
	}
}

# spawn task to run in the background
#
# please note that the it spawned a fresh nushell to execute the given command
# So it doesn't inherit current scope's variables, custom commands, alias definition, except env variables which value can convert to string.
#
# e.g:
# spawn { echo 3 }
export def spawn [
	command: closure   # the command to spawn
] {
	let config_path = $nu.config-path
	let env_path = $nu.env-path
	let source_code = (
		get_source_code $command
		| to json  # escape `"`, etc
		| str substring 2..-2  # cut `"{` and `}"`
	)
	let job_id = (^pueue add -p $"nu --config \"($config_path)\" --env-config \"($env_path)\" -c '($source_code)'")  # " <- fix nvim-treesitter syntax highlight
	{job_id: $job_id}
}

# raw-spawn task to run in the background
#
# raw-spawned tasks wont load any configurations, but keep env-vars
export def rspawn [
	command: closure  # the command to spawn
] {
	let source_code = (
		get_source_code $command
		| to json  # escape `"`, etc
		| str substring 2..-2  # remove `"{` and `}"`
	)
	let job_id = (^pueue add -p $'nu -c "($source_code)"')
	{job_id: $job_id}
}

export def log [id: int] {
	^pueue log $id -f --json
	| from json
	| transpose -i info
	| flatten --all
	| flatten --all
	| flatten status
	| get 0
}

# get job running status
export def status [] {
	pueue status --json
	| from json
	| get tasks
	| transpose -i status
	| flatten
	| flatten status
}

# kill specific job
export def kill [id: int] {
	pueue kill $id
}

# clean job log
export def clean [] {
	pueue clean
}

# send stdin to task
export def send [
	id: int
	input: string
	--no-newline(-n)
] {
	if $no_newline {
		^pueue send $id $input
	} else {
		^pueue send $id $"($input)\n"
	}
}

# wait for job to finish
export def wait [
	...ids: int
] {
	pueue wait $ids
}
