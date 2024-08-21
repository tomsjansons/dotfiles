
swayidle -w timeout 300 'bash /etc/nixos/system_scripts/swaylockwp.sh' timeout 600 'niri msg action power-off-monitors' before-sleep 'bash /etc/nixos/system_scripts/swaylockwp.sh'
