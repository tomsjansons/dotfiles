if ! pgrep -x 'swaylock' >/dev/null; then
  if [ -e ~/.theme-light ]; then
    swaylock -i /home/toms/.config/system_resources/view-light.jpg
  else
    swaylock -i /home/toms/.config/system_resources/view-dark.jpg
  fi
fi
