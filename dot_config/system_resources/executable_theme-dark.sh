#!/usr/bin/env bash

rm ~/.theme-light
touch ~/.theme-dark

notify-send --app-name="theme-switcher" --urgency=low --icon=weather-clear-night "switching to dark mode"

ls "/run/user/1000/" | grep 'nvim' | while read socket; do
nvim --server "/run/user/1000/$socket" --remote-send "<esc>:colorscheme catppuccin-mocha<cr><esc>:lua require('lualine').setup({options={theme='codedark'}})<cr><esc>:lua require('local-highlight').setup()<cr>"
done

ls "/run/user/1000/" | grep 'Alacritty' | while read socket; do
	alacritty msg -s "/run/user/1000/$socket" config "$(cat ~/.config/alacritty/catppuccin-mocha.toml)" -w -1
done

killall swaybg && /home/toms/.config/system_resources/swaybg.sh &
killall swayidle && /home/toms/.config/system_resources/swayidle.sh &

gsettings set org.gnome.desktop.interface gtk-theme "Adwaita:dark"
gsettings set org.gnome.desktop.interface color-scheme prefer-dark

sed -i 's/7287fd/cdd6f4/g' /home/toms/.config/niri/config.kdl
sed -i 's/dc8a78/f5e0dc/g' /home/toms/.config/niri/config.kdl
