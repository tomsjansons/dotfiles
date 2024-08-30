if ! pgrep -x 'swaylock' > /dev/null; then
	if [ -e ~/.theme-light ]; then
		swaylock -i /home/toms/.config/system_resources/astronaut_wp_lighter.jpg
	else
		swaylock -i /home/toms/.config/system_resources/astronaut_wp.jpg
	fi
fi
