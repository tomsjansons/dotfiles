#!/usr/bin/env bash

rm ~/.theme-dark
touch ~/.theme-light

notify-send --app-name="theme-switcher" --urgency=low --icon=weather-clear "switching to light mode"

ls "/run/user/1000/" | grep 'nvim' | while read socket; do
	nvim --server "/run/user/1000/$socket" --remote-send "<esc>:colorscheme catppuccin-latte<cr><esc>:lua require('lualine').setup({options={theme='ayu_light'}})<cr>"
done

ls "/run/user/1000/" | grep 'Alacritty' | while read socket; do
	alacritty msg -s "/run/user/1000/$socket" config "$(cat ~/.config/alacritty/catppuccin-latte.toml)" -w -1
done

killall swaybg && /home/toms/.config/system_resources/swaybg.sh &
killall swayidle && /home/toms/.config/system_resources/swayidle.sh &
