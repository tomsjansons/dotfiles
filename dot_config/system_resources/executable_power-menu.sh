#!/usr/bin/env bash

op=$( echo -e " Poweroff\n Reboot\n󱉚 Hibernate\n Suspend\n Lock\n Logout" | bash /home/toms/.config/system_resources/wofi.sh | awk '{print tolower($2)}' )

case $op in 
        poweroff)
                ;&
        reboot)
                systemctl $op
                ;;
        hibernate)
                # hyprlock & sleep 3 && systemctl $op
                systemctl $op
                ;;
        suspend)
                # hyprlock & sleep 3 && systemctl $op
                systemctl $op
                ;;
        lock)
                # hyprlock
                exec /home/toms/.config/system_resources/swaylockwp.sh
                ;;
        logout)
                # hyprctl dispatch exit
                niri msg action quit
                ;;
esac
