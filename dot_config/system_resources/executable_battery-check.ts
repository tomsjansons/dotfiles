#!usr/bin/env bun

import { $, file } from "bun";

const INTERVAL = 30;
const MIN_BAT = 10;
const MAX_BAT = 80;
const CRIT_BAT = 3;

async function getPluggedState() {
  const output: string = await file(
    "/sys/bus/acpi/drivers/battery/PNP0C0A:00/power_supply/BAT0/status",
  ).text();
  const state = output.split("\n")[0];
  return state;
}

async function getBatteryLevel() {
	await $`acpi`;
  const output: string = await $`acpi`.text();
  const percentStr = output.split(" ")[3].split("%")[0];
  const percent = Number(percentStr);
  return percent;
}

while (true) {
  const batPercent = await getBatteryLevel();
  const pluggedState = await getPluggedState();

  const markerFile = file("/tmp/battery-check-marker");

  if (pluggedState === "Discharging") {
    if (await markerFile.exists()) {
      await $`rm /tmp/battery-check-marker`;
    }
//
		//Nov 24 00:21:26 arch-l13 systemd[1]: battery-check.service: Main process exited, code=exited, status=1/FAILURE
// Nov 24 00:21:26 arch-l13 systemd[1]: battery-check.service: Failed with result 'exit-code'.
// Nov 24 00:21:29 arch-l13 systemd[1]: battery-check.service: Scheduled restart job, restart counter is at 23.
// Nov 24 00:21:29 arch-l13 systemd[1]: Started Battery check service.
// Nov 24 00:21:29 arch-l13 bun[8735]: Battery 0: Discharging, 9%, 00:24:50 remaining
// Nov 24 00:21:29 arch-l13 bun[8735]: Cannot autolaunch D-Bus without X11 $DISPLAY
// Nov 24 00:21:29 arch-l13 bun[8735]: 36 |
// Nov 24 00:21:29 arch-l13 bun[8735]: 37 |     if (batPercent < CRIT_BAT) {
// Nov 24 00:21:29 arch-l13 bun[8735]: 38 |       await $`notify-send -u critical -i /home/toms/.config/system_resources/icons8-sleep-50.png "Battery critical - hibernating"`;
// Nov 24 00:21:29 arch-l13 bun[8735]: 39 |       await $`systemctl hibernate`;
// Nov 24 00:21:29 arch-l13 bun[8735]: 40 |     } else if (batPercent < MIN_BAT) {
// Nov 24 00:21:29 arch-l13 bun[8735]: 41 |       await $`notify-send -u critical -i /home/toms/.config/system_resources/icons8-android-l-battery-64.png "Battery below ${MIN_BAT}"`;
// Nov 24 00:21:29 arch-l13 bun[8735]:                     ^
// Nov 24 00:21:29 arch-l13 bun[8735]: ShellError: Failed with exit code 1
// Nov 24 00:21:29 arch-l13 bun[8735]:  info: {
// Nov 24 00:21:29 arch-l13 bun[8735]:   "exitCode": 1,
// Nov 24 00:21:29 arch-l13 bun[8735]:   "stderr": "Cannot autolaunch D-Bus without X11 $DISPLAY\n",
// Nov 24 00:21:29 arch-l13 bun[8735]:   "stdout": ""
// Nov 24 00:21:29 arch-l13 bun[8735]: }
// Nov 24 00:21:29 arch-l13 bun[8735]:       at new ShellError (12:16)
// Nov 24 00:21:29 arch-l13 bun[8735]:       at new ShellPromise (72:16)
// Nov 24 00:21:29 arch-l13 bun[8735]:       at BunShell (187:35)
// Nov 24 00:21:29 arch-l13 bun[8735]:       at /home/toms/.config/system_resources/battery-check.ts:41:13
// Nov 24 00:21:29 arch-l13 bun[8735]: Bun v1.1.34 (Linux x64)
// Nov 24 00:21:29 arch-l13 systemd[1]: battery-check.service: Main process exited, code=exited, status=1/FAILURE
    if (batPercent < CRIT_BAT) {
      await $`notify-send -u critical -i /home/toms/.config/system_resources/icons8-sleep-50.png "Battery critical - hibernating"`;
      await $`systemctl hibernate`;
    } else if (batPercent < MIN_BAT) {
      await $`notify-send -u critical -i /home/toms/.config/system_resources/icons8-android-l-battery-64.png "Battery below ${MIN_BAT}"`;
    }
  }
  if (pluggedState === "Charging" && batPercent > MAX_BAT) {
    if (!(await markerFile.exists())) {
      await $`notify-send -u critical -i /home/toms/.config/system_resources/icons8-full-battery-64.png "Battery above ${MAX_BAT}"`;
      await $`touch /tmp/battery-check-marker`;
    }
  }

  await new Promise((resolve) => setTimeout(resolve, INTERVAL * 1000));
}
