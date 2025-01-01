#!/usr/bin/env bash

if [ -e ~/.theme-light ]; then
	/usr/bin/ghostty --theme=catppuccin-latte
else
	/usr/bin/ghostty --theme=catppuccin-mocha
fi
