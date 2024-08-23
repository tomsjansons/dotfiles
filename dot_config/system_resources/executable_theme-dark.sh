#!/usr/bin/env bash

notify-send --app-name="theme-switcher" --urgency=low --icon=weather-clear-night "switching to dark mode"

ls "/run/user/1000/" | grep 'nvim' | while read socket; do
nvim --server "/run/user/1000/$socket" --remote-send "<esc>:colorscheme catppuccin-mocha<cr><esc>:lua require('lualine').setup({options={theme='ayu_dark'}})<cr>"
done

ls "/run/user/1000/" | grep 'Alacritty' | while read socket; do
	alacritty msg -s "/run/user/1000/$socket" config "$(cat ~/.config/alacritty/catppuccin-mocha.toml)" -w -1
done

