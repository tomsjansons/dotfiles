#!/usr/bin/env bash

op=$( echo -e " Poweroff\n Reboot\n󱉚 Hibernate\n Suspend\n Lock\n Logout" | wofi -i --dmenu --sort-order=alphabetical | awk '{print tolower($2)}' )

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
                exec ~/.config/system_resources/swaylockwp.sh
                ;;
        logout)
                # hyprctl dispatch exit
                niri msg action quit
                ;;
esac
