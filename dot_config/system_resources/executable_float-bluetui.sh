#!/usr/bin/env bash

systemctl is-active --quiet bluetooth.service || systemctl start bluetooth.service

ghostty --title ghostty.bluetui -e bluetui
