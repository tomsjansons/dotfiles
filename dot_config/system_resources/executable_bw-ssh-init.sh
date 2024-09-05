#!/usr/bin/env zsh

export BW_SESSION=$(bw unlock --raw)

eval $(ssh-agent -s -t 60)

bw_add_sshkeys

zsh
