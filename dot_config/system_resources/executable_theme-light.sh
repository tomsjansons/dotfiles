#!/usr/bin/env bash

rm ~/.theme-dark
touch ~/.theme-light

notify-send --app-name="theme-switcher" --urgency=low --icon=weather-clear "switching to light mode"

ls "/run/user/1000/" | grep 'nvim' | while read socket; do
	nvim --server "/run/user/1000/$socket" --remote-send "<esc>:colorscheme catppuccin-latte<cr><esc>:lua require('lualine').setup({options={theme='ayu_light'}})<cr><esc>:lua require('local-highlight').setup()<cr>"
done

ls "/run/user/1000/" | grep 'Alacritty' | while read socket; do
	alacritty msg -s "/run/user/1000/$socket" config "$(cat ~/.config/alacritty/catppuccin-latte.toml)" -w -1
done

killall swaybg && /home/toms/.config/system_resources/swaybg.sh &
killall swayidle && /home/toms/.config/system_resources/swayidle.sh &

gsettings set org.gnome.desktop.interface gtk-theme "Adwaita:light"
gsettings set org.gnome.desktop.interface color-scheme prefer-light

sed -i 's/cdd6f4/7287fd/g' /home/toms/.config/niri/config.kdl
sed -i 's/f5e0dc/dc8a78/g' /home/toms/.config/niri/config.kdl
