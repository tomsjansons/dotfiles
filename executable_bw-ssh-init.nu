#!/usr/bin/env nu

{BW_SESSION:(bw unlock --raw)} | load-env

^ssh-agent -c -t 1h
    | lines
    | first 2
    | parse "setenv {name} {value};"
    | transpose -r
    | into record
    | load-env

bw_add_sshkeys
