# cvomx
eurorack compatible raspberryPI video player - written in nodejs - using Control Voltage (CV) and dbus to manipulate multiple OMXPlayers

![picture of first prototype](https://raw.githubusercontent.com/pauloandringa/cvomx/main/first_version_cvomx.jpg)

Comissioned and developed for a sound installation by artist João Pimenta Gomes, at the Gallery of the Portuguese Embassy in Berlin. (16/09/2021 - 20/10/2021)
links:

http://joaopimentagomes.com/

https://maat.pt/en/event/joao-pimenta-gomes-clouds

https://www.instagram.com/joaopimentagomes/

Made at the Mill (https://mill.pt)

## Components:
* [rPi_synth](https://github.com/sourya-sen/rPi_synth) board (from https://github.com/sourya-sen/rPi_synth)
* [5inch HDMI LCD](https://www.adafruit.com/product/2260) => [driver](https://github.com/waveshare/LCD-show)
* raspberry pi (minimum tested = Raspberry Pi 3 Model B Rev 1.2) running:
  * omxplayer
  * dbus
  * this nodejs app + this dbuscontrol.sh

### The code
* a) a NodeJS app to read values from an ADC MCP3008 Analog-to-Digital-Converter and a 74hc4051 Muxer, with 8 channels each, and control multiple OMXPlayer videoplayers and
* b) a modified dbuscontrol.sh file to control the running video players.

### The hardware control
* 4 POTs and 4 CV inputs connected to the ADC that can be used (as POT-CV pairs) to control different parameters
* 8 gate/switches connected to the MUXER than can be used as triggers

## Usage:
* 4 global 'live' parameters that apply to the 'active' video:
  * opacity
  * volume
  * speed
  * start position

* 3 upper buttons that apply to the 'active' video:
  * kill-this-player
  * 8 different 3d-glasses-effect (after a video restart) -> this is remembered over different executions
  * 17 different positions-on-screen (immediately) -> this is remembered over different executions

* 5 lower buttons trigger (re)starting a movie (from the first five found in the movies folder) using the 'live' parameters and the 'remembered' options

* the uppermost trigger is for forcing a shutdown (GPIO23 - PIN 16) - not yet implemented

## Technicalities:
On startup the app reads all files inside '/home/pi/cvomx/movies/' and creates a list with name-duration pairs - one for each found file. That list is then used to calculate the dynamic starting point, multiplying the 0-1 from the input by the duration of the movie to get an absolute-seconds position for the video player.

On the left side, there are 4 POTs and 4 CV inputs, connected to an ADC MCP3008.
* channels 0-1-2-3 receive the POTs values as a value between 0 and 1
* channels 4-5-6-7 receive the CV inputs values as a value between 0 and 1 (but for example the 'Qu-Bit Octone' only outputs between 0 and 5V, that the ADC sees as between 0.5 and 1... but I believe that other modules will output between -5 and 5v... that's eurorack for you :-))

* treating each POT+CV as a pair, we get the computed values for each row like this:
  * 0 - POT0 | CV0 - 4 ==> computedValue0 = Math.floor((pot0_value * varCV0_value) * 255); -> opacity, between 0 and 255 (0 is transparent, 255 is full opacity)
  * 1 - POT1 | CV1 - 5 ==> computedValue1 = (pot1_value * varCV1_value) * 2.5; -> volume, between 0 and 2.5 (1 is normal volume)
  * 2 - POT2 | CV2 - 6 ==> computedValue2 = (pot2_value * varCV2_value) * 8; -> speed, between 0 and 8 (1 is normal)
  * 3 - POT3 | CV3 - 7 ==> computedValue3 = (pot3_value * varCV3_value); -> startingPoint, between 0 and 1 (0 is the beginning of the movie)

On the right:
* a single piDown switch, connected to pin16 (GPIO23), that is used to powerdown the machine (softly, via software)
* the other 8 (3+5) switches are connected to a 74hc4051 MUXER, using this channel configuration:
  * [0, 0, 0], //channel 0
  * [1, 0, 0], //channel 1
  * [0, 1, 0], //channel 2
  * [1, 1, 0], //channel 3
  * [0, 0, 1], //channel 4
  * [1, 0, 1], //channel 5
  * [0, 1, 1], //channel 6
  * [1, 1, 1], //channel 7

* 3 switches/gates/triggers/? on the middle row:
  * 0 - kill-the-active-movie
  * 1 - change 3d-glasses-effect (active after movie restart, 7 different modes, harcoded) * remembered between plays
  * 2 - change position-on-screen (active immediately, 17 different modes, harcoded) * remembered between plays

* 5 switches/gates/triggers/? on the bottom row:
  * 3 - mark as active and start playing movie 1
  * 4 - mark as active and start playing movie 2
  * 5 - mark as active and start playing movie 3
  * 6 - mark as active and start playing movie 4
  * 7 - mark as active and start playing movie 5

### go get it:
```bash
git clone https://github.com/pauloandringa/cvomx
cd cvomx
npm install
```

### test it:
```bash
node index.js
```

### starting as a service:
(copy cvomx.service to /lib/systemd/system/cvomx.service, activate it and restart the systemd daemon)
```bash
sudo cp cvomx.service /lib/systemd/system/cvomx.service
sudo chmod 644 /lib/systemd/system/cvomx.service
sudo systemctl enable cvomx.service
sudo systemctl daemon-reload
```

## ffmpeg
all videos were converted with ffmpeg using this command line:

```bash
for file in `ls *.mp4`; do ffmpeg -i $file -ss 00:00:02.000 -filter_complex "scale=-2:480,crop=800:480:0:0,setsar=1:1" -r 25 -c:v h264 -pix_fmt yuv420p -tune fastdecode -movflags +faststart 800x480_tuned/$file; done
```

### /boot/config.txt
#### SCREEN STUFF:
```bash
hdmi_force_hotplug=1
hdmi_group=2
hdmi_mode=87
hdmi_cvt=800 480 60 6 0 0 0
hdmi_drive=1
```
#### GPU MEMORY:
```bash
gpu_mem=256
```
#### I2C, SPI, UART (to read ADC and one-pin-off):
```bash
dtparam=i2c_arm=on
dtparam=spi=on
enable_uart=1
```

#### TO ACCESS THE MUXER (74hc4051):
```bash
dtoverlay=gpio-no-irq
```
#### AUDIO:
```bash
dtparam=audio=on
```
#### TO ROTATE DISPLAY:
```bash
display_rotate=2
```
### /boot/cmdline.txt
add at end of line: (to hide console text after 10 seconds)
```bash
consoleblank=10
```


## extra - dbus functionality!
for the dbuscontrol.sh to work:
```bash
cd /home/pi/cvomx
sudo chmod a+x dbuscontrol.sh

export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/dbus/system_bus_socket
```

from my tests, this last command only needs to be executed once... more testing needed!
