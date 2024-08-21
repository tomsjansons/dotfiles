#!/usr/bin/env bash

notify-send --app-name="darkman" --urgency=low --icon=weather-clear "switching to light mode"


for server in $(nvr --serverlist); do
    nvr --servername "$server" -cc 'set background=light'
done
