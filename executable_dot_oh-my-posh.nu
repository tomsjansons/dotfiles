# make sure we have the right prompt render correctly
if ($env.config? | is-not-empty) {
    $env.config = ($env.config | upsert render_right_prompt_on_last_line true)
}

$env.POWERLINE_COMMAND = 'oh-my-posh'
$env.POSH_THEME = (echo "/home/toms/.config/oh-my-posh/capr4n.omp.json")
$env.PROMPT_INDICATOR = ""
$env.POSH_SESSION_ID = (echo "3b271e95-4fcd-431e-80b9-e72abb8ebdc9")
$env.POSH_SHELL = "nu"
$env.POSH_SHELL_VERSION = (version | get version)

let _omp_executable: string = (echo "/usr/bin/oh-my-posh")

# PROMPTS

def --wrapped _omp_get_prompt [
    type: string,
    ...args: string
] {
    mut execution_time = -1
    mut no_status = true
    # We have to do this because the initial value of `$env.CMD_DURATION_MS` is always `0823`, which is an official setting.
    # See https://github.com/nushell/nushell/discussions/6402#discussioncomment-3466687.
    if $env.CMD_DURATION_MS != '0823' {
        $execution_time = $env.CMD_DURATION_MS
        $no_status = false
    }

    (
        ^$_omp_executable print $type
            --save-cache
            --shell=nu
            $"--shell-version=($env.POSH_SHELL_VERSION)"
            $"--status=($env.LAST_EXIT_CODE)"
            $"--no-status=($no_status)"
            $"--execution-time=($execution_time)"
            $"--terminal-width=((term size).columns)"
            ...$args
    )
}

$env.PROMPT_MULTILINE_INDICATOR = (
    ^$_omp_executable print secondary
        --shell=nu
        $"--shell-version=($env.POSH_SHELL_VERSION)"
)

$env.PROMPT_COMMAND = {||
    # hack to set the cursor line to 1 when the user clears the screen
    # this obviously isn't bulletproof, but it's a start
    mut clear = false
    if $nu.history-enabled {
        $clear = (history | is-empty) or ((history | last 1 | get 0.command) == "clear")
    }

    if ($env.SET_POSHCONTEXT? | is-not-empty) {
        do --env $env.SET_POSHCONTEXT
    }

    _omp_get_prompt primary $"--cleared=($clear)"
}

$env.PROMPT_COMMAND_RIGHT = {|| _omp_get_prompt right }
