nwg-drawer -r -c 6 -is 64 -fscol 2 -s preset-0.css -term foot -ft -pbexit 'nwg-dialog -p exit-sway -c "swaymsg exit"' -pblock 'nwg-lock' -pbpoweroff 'nwg-dialog -p poweroff -c "systemctl -i poweroff"' -pbreboot 'nwg-dialog -p reboot -c "systemctl reboot"' -pbsleep 'nwg-dialog -p sleep -c "systemctl suspend"' -pbsize 48