-- Pull in the wezterm API
local wezterm = require("wezterm")

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
-- This will hold the configuration.
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
-- This is where you actually apply your config choices.

-- For example, changing the initial geometry for new windows:
config.initial_cols = 120
config.initial_rows = 28

-- or, changing the font size and color scheme.
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
}

-- Finally, return the configuration to wezterm:
return config
