#!/usr/bin/env bash

notify-send --app-name="theme-switcher" --urgency=low --icon=weather-clear "switching to light mode"

ls "/run/user/1000/" | grep 'nvim' | while read socket; do
	nvim --server "/run/user/1000/$socket" --remote-send "<esc>:set background=light<cr>"
done

ls "/run/user/1000/" | grep 'Alacritty' | while read socket; do
	alacritty msg -s "/run/user/1000/$socket" config "$(cat ~/.config/alacritty/gruvbox_light.toml)" -w -1
done
