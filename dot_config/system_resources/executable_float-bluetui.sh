#!/usr/bin/env bash

systemctl is-active --quiet bluetooth.service || systemctl start bluetooth.service

wezterm start --always-new-process --class wez.bluetui -- bluetui
