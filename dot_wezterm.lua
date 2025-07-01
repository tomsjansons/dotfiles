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

wezterm.on("update-right-status", function(window, pane)
	local leader = ""
	if window:leader_is_active() then
		leader = "LEADER"
	end
	window:set_right_status(leader)
end)

wezterm.add_to_config_reload_watch_list("/home/toms/.theme-light")

local config = wezterm.config_builder()
config.status_update_interval = 500
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

config.disable_default_key_bindings = true

config.scrollback_lines = 10000

config.enable_kitty_keyboard = true -- test to see if zellij in ssh work ok

config.font_size = 10
config.font = wezterm.font("FiraCode Nerd Font", { weight = 500 })
config.color_scheme = scheme_for_appearance()

config.ssh_domains = {
	{
		name = "ridi-dev-olive",
		remote_address = "ridi-dev-olive",
		username = "toms",
	},
}

local act = wezterm.action

config.leader = { key = "Space", mods = "ALT", timeout_milliseconds = 10000 }
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
	{ key = "e", mods = "LEADER|CTRL", action = act({ EmitEvent = "trigger-vim-with-scrollback" }) },
	{ key = "f", mods = "LEADER|CTRL", action = act.Search("CurrentSelectionOrEmptyString") },
	{ key = "c", mods = "LEADER|CTRL", action = act.ActivateCopyMode },
	{ key = "t", mods = "LEADER|CTRL", action = act.SpawnTab("CurrentPaneDomain") },
	{ key = "p", mods = "LEADER|CTRL", action = act.SplitVertical({ domain = "CurrentPaneDomain" }) },
	{ key = "P", mods = "LEADER|SHIFT|CTRL", action = act.SplitHorizontal({ domain = "CurrentPaneDomain" }) },
	{ key = "w", mods = "LEADER|CTRL", action = act.CloseCurrentTab({ confirm = true }) },
	{ key = "W", mods = "LEADER|SHIFT|CTRL", action = act.CloseCurrentPane({ confirm = true }) },
	{ key = "h", mods = "LEADER", action = act.ActivatePaneDirection("Left") },
	{ key = "l", mods = "LEADER", action = act.ActivatePaneDirection("Right") },
	{ key = "j", mods = "LEADER", action = act.ActivatePaneDirection("Down") },
	{ key = "k", mods = "LEADER", action = act.ActivatePaneDirection("Up") },
	{ key = "l", mods = "LEADER|CTRL", action = act.ActivateTabRelative(1) },
	{ key = "h", mods = "LEADER|CTRL", action = act.ActivateTabRelative(-1) },
	{ key = "1", mods = "LEADER|CTRL", action = act.ActivateTab(0) },
	{ key = "2", mods = "LEADER|CTRL", action = act.ActivateTab(1) },
	{ key = "3", mods = "LEADER|CTRL", action = act.ActivateTab(2) },
	{ key = "4", mods = "LEADER|CTRL", action = act.ActivateTab(3) },
	{ key = "5", mods = "LEADER|CTRL", action = act.ActivateTab(4) },
	{ key = "6", mods = "LEADER|CTRL", action = act.ActivateTab(5) },
	{ key = "7", mods = "LEADER|CTRL", action = act.ActivateTab(6) },
	{ key = "8", mods = "LEADER|CTRL", action = act.ActivateTab(7) },
	{ key = "9", mods = "LEADER|CTRL", action = act.ActivateTab(8) },
	{ key = "0", mods = "LEADER|CTRL", action = act.ActivateTab(9) },
	{ key = "V", mods = "SHIFT|CTRL", action = act.PasteFrom("Clipboard") },
	{ key = "C", mods = "SHIFT|CTRL", action = act.CopyTo("Clipboard") },
	-- { key = "Enter", mods = "ALT", action = act.ToggleFullScreen },
	-- { key = "!", mods = "CTRL", action = act.ActivateTab(0) },
	-- { key = "!", mods = "SHIFT|CTRL", action = act.ActivateTab(0) },
	-- { key = '"', mods = "ALT|CTRL", action = act.SplitVertical({ domain = "CurrentPaneDomain" }) },
	-- { key = '"', mods = "SHIFT|ALT|CTRL", action = act.SplitVertical({ domain = "CurrentPaneDomain" }) },
	-- { key = "#", mods = "CTRL", action = act.ActivateTab(2) },
	-- { key = "#", mods = "SHIFT|CTRL", action = act.ActivateTab(2) },
	-- { key = "$", mods = "CTRL", action = act.ActivateTab(3) },
	-- { key = "$", mods = "SHIFT|CTRL", action = act.ActivateTab(3) },
	-- { key = "%", mods = "CTRL", action = act.ActivateTab(4) },
	-- { key = "%", mods = "SHIFT|CTRL", action = act.ActivateTab(4) },
	-- { key = "%", mods = "ALT|CTRL", action = act.SplitHorizontal({ domain = "CurrentPaneDomain" }) },
	-- { key = "%", mods = "SHIFT|ALT|CTRL", action = act.SplitHorizontal({ domain = "CurrentPaneDomain" }) },
	-- { key = "&", mods = "CTRL", action = act.ActivateTab(6) },
	-- { key = "&", mods = "SHIFT|CTRL", action = act.ActivateTab(6) },
	-- { key = "'", mods = "SHIFT|ALT|CTRL", action = act.SplitVertical({ domain = "CurrentPaneDomain" }) },
	-- { key = "(", mods = "CTRL", action = act.ActivateTab(-1) },
	-- { key = "(", mods = "SHIFT|CTRL", action = act.ActivateTab(-1) },
	-- { key = ")", mods = "CTRL", action = act.ResetFontSize },
	-- { key = ")", mods = "SHIFT|CTRL", action = act.ResetFontSize },
	-- { key = "*", mods = "CTRL", action = act.ActivateTab(7) },
	-- { key = "*", mods = "SHIFT|CTRL", action = act.ActivateTab(7) },
	-- { key = "+", mods = "CTRL", action = act.IncreaseFontSize },
	-- { key = "+", mods = "SHIFT|CTRL", action = act.IncreaseFontSize },
	-- { key = "-", mods = "CTRL", action = act.DecreaseFontSize },
	-- { key = "-", mods = "SHIFT|CTRL", action = act.DecreaseFontSize },
	-- { key = "-", mods = "SUPER", action = act.DecreaseFontSize },
	-- { key = "0", mods = "CTRL", action = act.ResetFontSize },
	-- { key = "0", mods = "SHIFT|CTRL", action = act.ResetFontSize },
	-- { key = "0", mods = "SUPER", action = act.ResetFontSize },
	-- { key = "1", mods = "SHIFT|CTRL", action = act.ActivateTab(0) },
	-- { key = "1", mods = "SUPER", action = act.ActivateTab(0) },
	-- { key = "2", mods = "SHIFT|CTRL", action = act.ActivateTab(1) },
	-- { key = "2", mods = "SUPER", action = act.ActivateTab(1) },
	-- { key = "3", mods = "SHIFT|CTRL", action = act.ActivateTab(2) },
	-- { key = "3", mods = "SUPER", action = act.ActivateTab(2) },
	-- { key = "4", mods = "SHIFT|CTRL", action = act.ActivateTab(3) },
	-- { key = "4", mods = "SUPER", action = act.ActivateTab(3) },
	-- { key = "5", mods = "SHIFT|CTRL", action = act.ActivateTab(4) },
	-- { key = "5", mods = "SHIFT|ALT|CTRL", action = act.SplitHorizontal({ domain = "CurrentPaneDomain" }) },
	-- { key = "5", mods = "SUPER", action = act.ActivateTab(4) },
	-- { key = "6", mods = "SHIFT|CTRL", action = act.ActivateTab(5) },
	-- { key = "6", mods = "SUPER", action = act.ActivateTab(5) },
	-- { key = "7", mods = "SHIFT|CTRL", action = act.ActivateTab(6) },
	-- { key = "7", mods = "SUPER", action = act.ActivateTab(6) },
	-- { key = "8", mods = "SHIFT|CTRL", action = act.ActivateTab(7) },
	-- { key = "8", mods = "SUPER", action = act.ActivateTab(7) },
	-- { key = "9", mods = "SHIFT|CTRL", action = act.ActivateTab(-1) },
	-- { key = "9", mods = "SUPER", action = act.ActivateTab(-1) },
	-- { key = "=", mods = "CTRL", action = act.IncreaseFontSize },
	-- { key = "=", mods = "SHIFT|CTRL", action = act.IncreaseFontSize },
	-- { key = "=", mods = "SUPER", action = act.IncreaseFontSize },
	-- { key = "@", mods = "CTRL", action = act.ActivateTab(1) },
	-- { key = "@", mods = "SHIFT|CTRL", action = act.ActivateTab(1) },
	-- { key = "C", mods = "CTRL", action = act.CopyTo("Clipboard") },
	-- { key = "C", mods = "SHIFT|CTRL", action = act.CopyTo("Clipboard") },
	-- { key = "F", mods = "CTRL", action = act.Search("CurrentSelectionOrEmptyString") },
	-- { key = "F", mods = "SHIFT|CTRL", action = act.Search("CurrentSelectionOrEmptyString") },
	-- { key = "K", mods = "CTRL", action = act.ClearScrollback("ScrollbackOnly") },
	-- { key = "K", mods = "SHIFT|CTRL", action = act.ClearScrollback("ScrollbackOnly") },
	-- { key = "L", mods = "CTRL", action = act.ShowDebugOverlay },
	-- { key = "L", mods = "SHIFT|CTRL", action = act.ShowDebugOverlay },
	-- { key = "M", mods = "CTRL", action = act.Hide },
	-- { key = "M", mods = "SHIFT|CTRL", action = act.Hide },
	-- { key = "N", mods = "CTRL", action = act.SpawnWindow },
	-- { key = "N", mods = "SHIFT|CTRL", action = act.SpawnWindow },
	-- { key = "P", mods = "CTRL", action = act.ActivateCommandPalette },
	-- { key = "P", mods = "SHIFT|CTRL", action = act.ActivateCommandPalette },
	-- { key = "R", mods = "CTRL", action = act.ReloadConfiguration },
	-- { key = "R", mods = "SHIFT|CTRL", action = act.ReloadConfiguration },
	-- { key = "T", mods = "CTRL", action = act.SpawnTab("CurrentPaneDomain") },
	-- { key = "T", mods = "SHIFT|CTRL", action = act.SpawnTab("CurrentPaneDomain") },
	-- {
	-- 	key = "U",
	-- 	mods = "CTRL",
	-- 	action = act.CharSelect({ copy_on_select = true, copy_to = "ClipboardAndPrimarySelection" }),
	-- },
	-- {
	-- 	key = "U",
	-- 	mods = "SHIFT|CTRL",
	-- 	action = act.CharSelect({ copy_on_select = true, copy_to = "ClipboardAndPrimarySelection" }),
	-- },
	-- { key = "V", mods = "CTRL", action = act.PasteFrom("Clipboard") },
	-- { key = "V", mods = "SHIFT|CTRL", action = act.PasteFrom("Clipboard") },
	-- { key = "W", mods = "CTRL", action = act.CloseCurrentTab({ confirm = true }) },
	-- { key = "W", mods = "SHIFT|CTRL", action = act.CloseCurrentTab({ confirm = true }) },
	-- { key = "X", mods = "CTRL", action = act.ActivateCopyMode },
	-- { key = "X", mods = "SHIFT|CTRL", action = act.ActivateCopyMode },
	-- { key = "Z", mods = "CTRL", action = act.TogglePaneZoomState },
	-- { key = "Z", mods = "SHIFT|CTRL", action = act.TogglePaneZoomState },
	-- { key = "[", mods = "SHIFT|SUPER", action = act.ActivateTabRelative(-1) },
	-- { key = "]", mods = "SHIFT|SUPER", action = act.ActivateTabRelative(1) },
	-- { key = "^", mods = "CTRL", action = act.ActivateTab(5) },
	-- { key = "^", mods = "SHIFT|CTRL", action = act.ActivateTab(5) },
	-- { key = "_", mods = "CTRL", action = act.DecreaseFontSize },
	-- { key = "_", mods = "SHIFT|CTRL", action = act.DecreaseFontSize },
	-- { key = "c", mods = "SHIFT|CTRL", action = act.CopyTo("Clipboard") },
	-- { key = "c", mods = "SUPER", action = act.CopyTo("Clipboard") },
	-- { key = "e", mods = "CTRL|LEADER", action = act.EmitEvent("trigger-vim-with-scrollback") },
	-- { key = "f", mods = "SHIFT|CTRL", action = act.Search("CurrentSelectionOrEmptyString") },
	-- { key = "f", mods = "SUPER", action = act.Search("CurrentSelectionOrEmptyString") },
	-- { key = "k", mods = "SHIFT|CTRL", action = act.ClearScrollback("ScrollbackOnly") },
	-- { key = "k", mods = "SUPER", action = act.ClearScrollback("ScrollbackOnly") },
	-- { key = "l", mods = "SHIFT|CTRL", action = act.ShowDebugOverlay },
	-- { key = "m", mods = "SHIFT|CTRL", action = act.Hide },
	-- { key = "m", mods = "SUPER", action = act.Hide },
	-- { key = "n", mods = "SHIFT|CTRL", action = act.SpawnWindow },
	-- { key = "n", mods = "SUPER", action = act.SpawnWindow },
	-- { key = "n", mods = "CTRL|LEADER", action = act.SpawnWindow },
	-- { key = "p", mods = "SHIFT|CTRL", action = act.ActivateCommandPalette },
	-- { key = "r", mods = "SHIFT|CTRL", action = act.ReloadConfiguration },
	-- { key = "r", mods = "SUPER", action = act.ReloadConfiguration },
	-- { key = "t", mods = "SHIFT|CTRL", action = act.SpawnTab("CurrentPaneDomain") },
	-- { key = "t", mods = "SUPER", action = act.SpawnTab("CurrentPaneDomain") },
	-- {
	-- 	key = "u",
	-- 	mods = "SHIFT|CTRL",
	-- 	action = act.CharSelect({ copy_on_select = true, copy_to = "ClipboardAndPrimarySelection" }),
	-- },
	-- { key = "v", mods = "SHIFT|CTRL", action = act.PasteFrom("Clipboard") },
	-- { key = "v", mods = "SUPER", action = act.PasteFrom("Clipboard") },
	-- { key = "w", mods = "SHIFT|CTRL", action = act.CloseCurrentTab({ confirm = true }) },
	-- { key = "w", mods = "SUPER", action = act.CloseCurrentTab({ confirm = true }) },
	-- { key = "x", mods = "SHIFT|CTRL", action = act.ActivateCopyMode },
	-- { key = "z", mods = "SHIFT|CTRL", action = act.TogglePaneZoomState },
	-- { key = "{", mods = "SUPER", action = act.ActivateTabRelative(-1) },
	-- { key = "{", mods = "SHIFT|SUPER", action = act.ActivateTabRelative(-1) },
	-- { key = "}", mods = "SUPER", action = act.ActivateTabRelative(1) },
	-- { key = "}", mods = "SHIFT|SUPER", action = act.ActivateTabRelative(1) },
	-- { key = "phys:Space", mods = "SHIFT|CTRL", action = act.QuickSelect },
	-- { key = "phys:Space", mods = "CTRL|LEADER", action = act.SendKey({ key = "Space", mods = "CTRL" }) },
	-- { key = "PageUp", mods = "SHIFT", action = act.ScrollByPage(-1) },
	-- { key = "PageUp", mods = "CTRL", action = act.ActivateTabRelative(-1) },
	-- { key = "PageUp", mods = "SHIFT|CTRL", action = act.MoveTabRelative(-1) },
	-- { key = "PageDown", mods = "SHIFT", action = act.ScrollByPage(1) },
	-- { key = "PageDown", mods = "CTRL", action = act.ActivateTabRelative(1) },
	-- { key = "PageDown", mods = "SHIFT|CTRL", action = act.MoveTabRelative(1) },
	-- { key = "LeftArrow", mods = "SHIFT|CTRL", action = act.ActivatePaneDirection("Left") },
	-- { key = "LeftArrow", mods = "SHIFT|ALT|CTRL", action = act.AdjustPaneSize({ "Left", 1 }) },
	-- { key = "RightArrow", mods = "SHIFT|CTRL", action = act.ActivatePaneDirection("Right") },
	-- { key = "RightArrow", mods = "SHIFT|ALT|CTRL", action = act.AdjustPaneSize({ "Right", 1 }) },
	-- { key = "UpArrow", mods = "SHIFT|CTRL", action = act.ActivatePaneDirection("Up") },
	-- { key = "UpArrow", mods = "SHIFT|ALT|CTRL", action = act.AdjustPaneSize({ "Up", 1 }) },
	-- { key = "DownArrow", mods = "SHIFT|CTRL", action = act.ActivatePaneDirection("Down") },
	-- { key = "DownArrow", mods = "SHIFT|ALT|CTRL", action = act.AdjustPaneSize({ "Down", 1 }) },
	-- { key = "Insert", mods = "SHIFT", action = act.PasteFrom("PrimarySelection") },
	-- { key = "Insert", mods = "CTRL", action = act.CopyTo("PrimarySelection") },
	-- { key = "Copy", mods = "NONE", action = act.CopyTo("Clipboard") },
	-- { key = "Paste", mods = "NONE", action = act.PasteFrom("Clipboard") },
}

config.colors = {
	compose_cursor = "orange",
}

return config
