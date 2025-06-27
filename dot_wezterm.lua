-- Pull in the wezterm API
local wezterm = require("wezterm")
local io = require("io")
local os = require("os")

wezterm.on("trigger-vim-with-scrollback", function(window, pane)
	-- Retrieve the current viewport's text.
	-- Pass an optional number of lines (eg: 2000) to retrieve
	-- that number of lines starting from the bottom of the viewport
	local scrollback = pane:get_lines_as_text()

	-- Create a temporary file to pass to vim
	local name = os.tmpname()
	local f = io.open(name, "w+")
	f:write(scrollback)
	f:flush()
	f:close()

	-- Open a new window running vim and tell it to open the file
	window:perform_action(
		wezterm.action({ SpawnCommandInNewWindow = {
			args = { "vim", name },
		} }),
		pane
	)

	-- wait "enough" time for vim to read the file before we remove it.
	-- The window creation and process spawn are asynchronous
	-- wrt. running this script and are not awaitable, so we just pick
	-- a number.
	wezterm.sleep_ms(1000)
	os.remove(name)
end)

local function file_exists(name)
	local f = io.open(name, "r")
	if f ~= nil then
		io.close(f)
		return true
	else
		return false
	end
end

local function scheme_for_appearance()
	if not file_exists("/home/toms/.theme-light") then
		return "Catppuccin Mocha"
	else
		return "Catppuccin Latte"
	end
end

wezterm.add_to_config_reload_watch_list("/home/toms/.theme-light")

local config = wezterm.config_builder()
config.hide_tab_bar_if_only_one_tab = true
config.window_close_confirmation = "AlwaysPrompt"
config.skip_close_confirmation_for_processes_named = {
	"bash",
	"sh",
	"zsh",
	"fish",
	"tmux",
	"nu",
	"cmd.exe",
	"pwsh.exe",
	"powershell.exe",
	"numbat",
	"yazi",
	"impala",
	"bluetui",
}

config.initial_cols = 120
config.initial_rows = 28

config.scrollback_lines = 10000

config.font_size = 10
config.font = wezterm.font("FiraCode Nerd Font", { weight = 500 })
config.color_scheme = scheme_for_appearance()

config.leader = { key = "Space", mods = "CTRL", timeout_milliseconds = 1000 }
config.keys = {
	-- Send "CTRL-SPACE" to the terminal when pressing CTRL-SPACE, CTRL-SPACE
	{
		key = "Space",
		mods = "LEADER|CTRL",
		action = wezterm.action.SendKey({ key = "Space", mods = "CTRL" }),
	},
	{
		key = "n",
		mods = "LEADER|CTRL",
		action = wezterm.action.SpawnWindow,
	},
	{ key = "e", mods = "LEADER|CTRL", action = wezterm.action({ EmitEvent = "trigger-vim-with-scrollback" }) },
}

return config
