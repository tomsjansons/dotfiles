#!/usr/bin/env bash

systemctl is-active --quiet bluetooth.service || systemctl start bluetooth.service

/home/toms/.config/system_resources/alacritty.sh -T bluetui -e bluetui
