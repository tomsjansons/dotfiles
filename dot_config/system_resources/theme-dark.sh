#!/usr/bin/env bash

notify-send --app-name="theme-switcher" --urgency=low --icon=weather-clear-night "switching to dark mode"

for server in $(nvr --serverlist); do
    nvr --servername "$server" -cc 'set background=dark'
done
