"use strict";
let joystickON = false;

let keyboardON = false;


// to check for files in the filesystem we need this:
let fs = require('fs');

// and to be able to execute stuff (like killing omxplayers using killall):
let exec = require('child_process').exec;


// we start by killing all existing omx processes:
let killAll0 = exec("killall omxplayer.bin", function (err, stdout, stderr) {
    if (err) {
        // should have err.code here?
    }
    console.log(stdout);
    console.log("---- WELCOME TO CVOMX ----");
    console.log("starting up -> killing all remaining omxplayers!");
});

// we're going to use this to check and format time
let TimeFormat = require('hh-mm-ss');

// we then load the library for omxplayer control
let OmxManager = require('omx-manager');
// and create a new manager from the start:
let manager = new OmxManager(); // OmxManager

// we start up a variable to use for transparency (it goes from 0 to 255)
let minalpha = 0;
let maxalpha = 255;
let alpha = 120;

// we start up a variable to use for transparency (it goes from 0 to 255)
let minanaglyph = 0;
let maxanaglyph = 8;
let anaglyph = 0;


// our mother folder:
let motherFolder = "/home/pi/cvomx/";

// our media folder:
let mediaFolder = "/home/pi/cvomx/movies/";

/*
the list of files...
for speed reasons, we have a pre-created bi-dimensional array with filename-duration pairs
we then use it to check duration when starting up clips

it is probably doable to use ffprobe (part of ffmpeg) to fill the array at startup...
*/

let videoFiles = [];

const VideoLib = require('node-video-lib');

fs.readdir(mediaFolder, (err, files) => {
    if (err) {
        throw err;
    }

    // files object contains all files names
    // log them on console
    files.forEach(file => {
        // console.log(file);


        fs.open(mediaFolder + file, 'r', function (err, fd) {
            try {
                let movie = VideoLib.MovieParser.parse(fd);
                // Work with movie
                console.log([file, TimeFormat.fromS(movie.relativeDuration())]);
                videoFiles.push([file, TimeFormat.fromS(movie.relativeDuration())]);
            } catch (ex) {
                console.error('Error:', ex);
            } finally {
                fs.closeSync(fd);
                videoFiles.sort();
                console.log(videoFiles);
            }
        });
    });
});


// we check for the size of this list
let movieListSize = videoFiles.length;
// and write it to console
console.log("number of files in list: " + movieListSize);

// initializing the camera object, where we will put our 'kind-of-pointers'
let camera = Array();

/*
values:
alpha: 0 - 255
anaglyph: 0 - 8
position: 0 - 1


*/

let activeFilm = 0;

let windowHorizontalResolution = 800;
let windowVerticalResolution = 480;

let screenMode = [
    ['fullScreen', 0 + ',' + 0 + ',' + Math.floor(windowHorizontalResolution) + ',' + Math.floor(windowVerticalResolution)],
    ['firstQuadrant', 0 + ',' + 0 + ',' + Math.floor(windowHorizontalResolution / 2) + ',' + Math.floor(windowVerticalResolution / 2)],
    ['secondQuadrant', Math.floor(windowHorizontalResolution / 2) + ',' + 0 + ',' + Math.floor(windowHorizontalResolution) + ',' + Math.floor(windowVerticalResolution / 2)],
    ['thirdQuadrant', 0 + ',' + Math.floor(windowVerticalResolution / 2) + ',' + Math.floor(windowHorizontalResolution / 2) + ',' + Math.floor(windowVerticalResolution)],
    ['fourthQuadrant', Math.floor(windowHorizontalResolution / 2) + ',' + Math.floor(windowVerticalResolution / 2) + ',' + Math.floor(windowHorizontalResolution) + ',' + Math.floor(windowVerticalResolution)],

    ['firsthalf', 0 + ',' + 0 + ',' + Math.floor(windowHorizontalResolution) + ',' + Math.floor(windowVerticalResolution / 2)],
    ['secondhalf', 0 + ',' + Math.floor((windowVerticalResolution / 4) * 2) + ',' + Math.floor(windowHorizontalResolution) + ',' + Math.floor(windowVerticalResolution)],

    ['firstVhalf', 0 + ',' + 0 + ',' + Math.floor(windowHorizontalResolution / 2) + ',' + Math.floor(windowVerticalResolution)],
    ['secondVhalf', Math.floor(windowHorizontalResolution / 2) + ',' + 0 + ',' + Math.floor(windowHorizontalResolution) + ',' + Math.floor(windowVerticalResolution)],

    ['firstStripe', 0 + ',' + 0 + ',' + Math.floor(windowHorizontalResolution) + ',' + Math.floor(windowVerticalResolution / 4)],
    ['secondStripe', 0 + ',' + Math.floor(windowVerticalResolution / 4) + ',' + Math.floor(windowHorizontalResolution) + ',' + Math.floor(windowVerticalResolution / 2)],
    ['thirdStripe', 0 + ',' + Math.floor((windowVerticalResolution / 4) * 2) + ',' + Math.floor(windowHorizontalResolution) + ',' + Math.floor((windowVerticalResolution / 4) * 3)],
    ['fourthStripe', 0 + ',' + Math.floor((windowVerticalResolution / 4) * 3) + ',' + Math.floor(windowHorizontalResolution) + ',' + Math.floor((windowVerticalResolution))],

    ['firstVStripe', 0 + ',' + 0 + ',' + Math.floor(windowHorizontalResolution / 4) + ',' + Math.floor(windowVerticalResolution)],
    ['secondVStripe', Math.floor(windowHorizontalResolution / 4) + ',' + 0 + ',' + Math.floor(windowHorizontalResolution / 2) + ',' + Math.floor(windowVerticalResolution)],
    ['thirdVStripe', Math.floor((windowHorizontalResolution / 4) * 2) + ',' + 0 + ',' + Math.floor((windowHorizontalResolution / 4) * 3) + ',' + Math.floor((windowVerticalResolution))],
    ['fourthVStripe', Math.floor((windowHorizontalResolution / 4) * 3) + ',' + 0 + ',' + Math.floor(windowHorizontalResolution) + ',' + Math.floor((windowVerticalResolution))],
]

let screenModes = screenMode.length;



/*
our function for doing-the-magic:
for each received marker we do stuff:
a) check if the marker we just saw refers to a file that is in the list (could be noise)
b) check for the file in the filesystem (could be gone)
c) use the values to control instances of omxplayer

*/
let createNewVideo = function (filme) {
    // console.log(filme.id); // to get the full data
    let filmeID = filme; // the marker number
    // console.log(filme + " <- IN!"); // shout!
    // console.log(videoFiles[activeFilm]); // shout!
    // let filmePad = ("000" + filmeID).substr(-3, 3); // zeropad the markers
    // let filmeName = filmePad + ".mp4"; // full name for searches
    if (videoFiles[activeFilm]) {
        let filmeName = videoFiles[activeFilm][0];
        // console.log("filmeName: ", mediaFolder + filmeName);


        // iterate over values in videoFiles array to check for this one:
        for (let k = 0; k < videoFiles.length; k++) {
            if (videoFiles[k][0] == filmeName) {
                let found = true;
                // if found attribute duration
                let duration = videoFiles[k][1];
                // and write it out to screen
                console.log("this movie name exists in the list! -> ", mediaFolder + filmeName);

                // then check for its existence in the filesystem
                fs.stat(mediaFolder + filmeName + '', function (err, stat) {
                    if (err == null) {
                        // and write it out to screen
                        // console.log("this movie exists in the filesystem! -> " + filmeName);

                        // treat the duration (from hh:mm:ss to seconds)
                        let durationInSeconds = TimeFormat.toS(duration);
                        // use the startValue to calculate where to start
                        let startPosition = videoFiles[activeFilm].startValue ? Math.floor(videoFiles[activeFilm].startValue * durationInSeconds) : 0;
                        // videoFiles[activeFilm].startPosition = startPosition;
                        // console.log("startPosition: " + startPosition);
                        // let startPosition = 0;
                        // and go back to the hh:mm:ss format that omxplayer likes
                        let accurateStart = TimeFormat.fromS(startPosition, 'hh:mm:ss');
                        // videoFiles[activeFilm].accurateStart = accurateStart;
                        // console.log("duration: " + videoFiles[0][1]);
                        // console.log("accurateStart: " + accurateStart);

                        // we use the alphaValue to calculate alpha:
                        let thisAlpha = videoFiles[activeFilm].alphaValue ? videoFiles[activeFilm].alphaValue : 255;
                        videoFiles[activeFilm].alphaValue = thisAlpha;
                        // console.log("alpha: " + thisAlpha);

                        // speed value:
                        let thisSpeed = videoFiles[activeFilm].speed ? videoFiles[activeFilm].speed : 1;
                        videoFiles[activeFilm].speed = thisSpeed;
                        // console.log("speed: " + thisSpeed);

                        // volume value:
                        let thisVolume = videoFiles[activeFilm].volume ? videoFiles[activeFilm].volume : 1;
                        videoFiles[activeFilm].volume = thisVolume;
                        // console.log("volume: " + thisVolume);

                        // we use the filterValue to choose an effect from the 9 [0-indexed] that omxplayer knows (see list at end of file)
                        // let anaglyph = Math.floor((filme.filterValue / (Math.PI * 2)) * 8);
                        let anaglyph = videoFiles[activeFilm].filterValue ? videoFiles[activeFilm].filterValue : 0;
                        // videoFiles[activeFilm].filterValue = anaglyph;
                        // console.log("anaglyph: " + anaglyph);

                        // we use the screenMode to position the window from a (predefined) list of positions:
                        let window = videoFiles[activeFilm].screenMode ? screenMode[videoFiles[activeFilm].screenMode][1] : screenMode[0][1];
                        // videoFiles[activeFilm].window = window;
                        // console.log("window: " + window);

                        // if it's running - stop it and clear it
                        if (camera[filmeID]) {
                            camera[filmeID].stop();
                            camera[filmeID] = null;
                        }
                        // create a new camera object inside our manager with the values calculated earlier
                        camera[filmeID] = manager.create([mediaFolder + filmeName], { '--loop': true, '--pos': accurateStart, '--alpha': thisAlpha, '--anaglyph': anaglyph, '--win': window, '--layer': filmeID, '--dbus_name': 'org.mpris.MediaPlayer2.omxplayer' + filmeID, '--vol': 200, '--no-osd': true, '--lavfdopts': 'probesize:100000,avioflags:direct,fflags:fastseek', '--nohdmiclocksync': true, '--nodeinterlace': true }); // OmxInstance
                        camera[filmeID].play(); // start the process of playing videos
                        // console.log("this movie: ", camera[filmeID]);

                        console.log("active film: ", videoFiles[activeFilm]);
                    }
                });

            } else {
                // console.log("this is probably an error, there is no --> " + filmeName);
            }
        }
    }
};



/* we also have a destroy action: */
let destroyVideo = function (filme) {
    console.log(filme + " <- OUT!");
    let filmeID = filme;
    if (camera[filmeID]) {
        camera[filmeID].stop();
        camera[filmeID] = null;
    }
}






// keyboard control:
if (keyboardON == true) {

    let keypress = require('keypress');

    // make `process.stdin` begin emitting "keypress" events
    keypress(process.stdin);

    // listen for the "keypress" event
    process.stdin.on('keypress', function (ch, key) {
        console.log('got "keypress"', key);

        // film 1
        if (key && key.shift != true && key.name == 'q') {
            activeFilm = 0;
            console.log('vídeo 1 ACTIVE');
        }
        // if (key && key.shift == true && key.name == 'q') {
        //     console.log('vídeo 1 OFF');
        // }

        // film 2
        if (key && key.shift != true && key.name == 'w') {
            activeFilm = 1;
            console.log('vídeo 2 ACTIVE');
        }

        // film 3
        if (key && key.shift != true && key.name == 'e') {
            activeFilm = 2;
            console.log('vídeo 3 ACTIVE');
        }

        // film 4
        if (key && key.shift != true && key.name == 'r') {
            activeFilm = 3;
            console.log('vídeo 4 ACTIVE');
        }

        // film 5
        if (key && key.shift != true && key.name == 't') {
            activeFilm = 4;
            console.log('vídeo 5 ACTIVE');
        }

        // start/stop/pause movies:
        if (key && key.shift != true && key.name == 'space') {
            createNewVideo(activeFilm);
            console.log('vídeo ' + activeFilm + ' PLAYING');
        }
        if (key && key.shift != true && key.name == 'return') {
            destroyVideo(activeFilm);
            console.log('vídeo ' + activeFilm + ' KILLED');
        }

        if (key && key.name == 'p') {
            let pauseFilm = exec(motherFolder + "dbuscontrol.sh pause " + activeFilm, function (err, stdout, stderr) {
                if (err) {
                    // should have err.code here?
                }
                console.log(stdout);
            });
            console.log('vídeo ' + activeFilm + ' paused');
        }



        // volume up/down:
        if (key && key.name == 'd') {
            console.log('change volume ++ ');
            let changeVolume = exec(motherFolder + "dbuscontrol.sh volumeup " + activeFilm, function (err, stdout, stderr) {
                if (err) {
                    // should have err.code here?
                }
                console.log(stdout);
            });

        }
        if (key && key.name == 'c') {
            console.log('change volume -- ');
            let changeVolume = exec(motherFolder + "dbuscontrol.sh volumedown " + activeFilm, function (err, stdout, stderr) {
                if (err) {
                    // should have err.code here?
                }
                console.log(stdout);
            });
        }

        // alpha up/down:
        if (key && key.name == 'a') {
            if (videoFiles[activeFilm].alphaValue < maxalpha) {
                videoFiles[activeFilm].alphaValue = Math.floor(videoFiles[activeFilm].alphaValue + 5);
                console.log('change alpha ++ [', videoFiles[activeFilm], ']');
                let changeAlpha = exec(motherFolder + "dbuscontrol.sh setalpha " + videoFiles[activeFilm].alphaValue + " " + activeFilm, function (err, stdout, stderr) {
                    if (err) {
                        // should have err.code here?
                    }
                    console.log(stdout);
                });
            } else {
                console.log('alpha is at max already...');
            }
        }
        if (key && key.name == 'z') {
            if (videoFiles[activeFilm].alphaValue > minalpha) {
                videoFiles[activeFilm].alphaValue = Math.floor(videoFiles[activeFilm].alphaValue - 5);
                console.log('change alpha -- [', videoFiles[activeFilm], ']');
                let changeAlpha = exec(motherFolder + "dbuscontrol.sh setalpha " + videoFiles[activeFilm].alphaValue + " " + activeFilm, function (err, stdout, stderr) {
                    if (err) {
                        // should have err.code here?
                    }
                    console.log(stdout);
                });
            } else {
                console.log('alpha is at min already...');
            }
        }


        // position on screen:
        if (key && key.name == 'f') {
            if ((videoFiles[activeFilm].screenMode + 1) < screenModes) {
                videoFiles[activeFilm].screenMode = Math.floor(videoFiles[activeFilm].screenMode + 1);
                console.log('change screenMode ++ [', videoFiles[activeFilm], ']', screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' '));
                let changePosition = exec(motherFolder + "dbuscontrol.sh setvideopos " + screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' ') + " " + activeFilm, function (err, stdout, stderr) {
                    if (err) {
                        // should have err.code here?
                    }
                    console.log(stdout);
                });
            } else {
                console.log('screenMode is at max already...');
                videoFiles[activeFilm].screenMode = 0;
                console.log('change screenMode deu a volta [', videoFiles[activeFilm], ']', screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' '));
                let changePosition = exec(motherFolder + "dbuscontrol.sh setvideopos " + screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' ') + " " + activeFilm, function (err, stdout, stderr) {
                    if (err) {
                        // should have err.code here?
                    }
                    console.log(stdout);
                });
            }
        }
        if (key && key.name == 'v') {
            if (videoFiles[activeFilm].screenMode > 0) {
                videoFiles[activeFilm].screenMode = Math.floor(videoFiles[activeFilm].screenMode - 1);
                console.log('change screenMode -- [', videoFiles[activeFilm], ']', screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' '));
                let changePosition = exec(motherFolder + "dbuscontrol.sh setvideopos " + screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' ') + " " + activeFilm, function (err, stdout, stderr) {
                    if (err) {
                        // should have err.code here?
                    }
                    console.log(stdout);
                });
            } else {
                console.log('screenMode is at min already...');
                videoFiles[activeFilm].screenMode = Math.floor(screenModes - 1);
                console.log('change screenMode deu a volta! [', videoFiles[activeFilm], ']', screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' '));
                let changePosition = exec(motherFolder + "dbuscontrol.sh setvideopos " + screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' ') + " " + activeFilm, function (err, stdout, stderr) {
                    if (err) {
                        // should have err.code here?
                    }
                    console.log(stdout);
                });

            }
        }
        // change anaglyph value:
        if (key && key.name == 's') {
            if (videoFiles[activeFilm].filterValue < maxanaglyph) {
                videoFiles[activeFilm].filterValue = Math.floor(videoFiles[activeFilm].filterValue + 1);
                console.log('change anaglyph ++ [', videoFiles[activeFilm], ']');
            } else {
                console.log('anaglyph is at max already...');
                videoFiles[activeFilm].filterValue = 0;
                console.log('change anaglyph deu a volta [', videoFiles[activeFilm], ']', videoFiles[activeFilm].filterValue);
            }
        }
        if (key && key.name == 'x') {
            if (videoFiles[activeFilm].filterValue > minanaglyph) {
                videoFiles[activeFilm].filterValue = Math.floor(videoFiles[activeFilm].filterValue - 1);
                console.log('change anaglyph -- [', videoFiles[activeFilm], ']');
            } else {
                console.log('anaglyph is at min already...');
                videoFiles[activeFilm].filterValue = maxanaglyph;
            }
        }

    });


    process.stdin.setRawMode(true);
    process.stdin.resume();

} // fim do keyboard off









const scaleAlpha = (num, in_min, in_max, out_min, out_max) => {
    return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

if (joystickON == true) {

    // joystick control:
    // Set a deadzone of +/-3500 (out of +/-32k) and a sensitivty of 350 to reduce signal noise in joystick axis
    let joystick = new (require('joystick'))(0, 3500, 2000);
    console.log("joystick: ", joystick);

    let trigger0on = false;

    joystick.on('button', (event_button) => {
        if (event_button.number === 0) {
            if (event_button.value === 0) {
                console.log("trigger0on = false");
                trigger0on = false;
            } else {
                console.log("trigger0on = true");
                trigger0on = true;
            }
        }
    });

    joystick.on('axis', (event_axis) => {
        console.log(event_axis);

        // alpha on rotation:
        if (event_axis.number == 2) {
            if (trigger0on == true) {
                console.log("alpha: ", event_axis.value, Math.floor(scaleAlpha(event_axis.value, -32767, 32767, 0, 255)));
                videoFiles[activeFilm].alphaValue = Math.floor(scaleAlpha(event_axis.value, -32767, 32767, 0, 255));
                console.log('change alpha ?? [', videoFiles[activeFilm], ']');
                let changeAlpha = exec(motherFolder + "dbuscontrol.sh setalpha " + videoFiles[activeFilm].alphaValue + " " + activeFilm, function (err, stdout, stderr) {
                    if (err) {
                        // should have err.code here?
                    }
                    console.log(stdout);
                });

            }
        }

        // start position with bottom +/- thingy::
        if (event_axis.number == 3) {
            console.log("position: ", event_axis.value, scaleAlpha(event_axis.value, -32767, 32767, 0, 1));
            videoFiles[activeFilm].startValue = scaleAlpha(event_axis.value, -32767, 32767, 0, 1);
        }

        // joystick.on('axis ENDS:
    });

    // joystickON endif:
};





// ler POTs e triggers ligados à mcp:
const mcpadc = require('mcp-spi-adc');

// ---------------------------------------
// FIRST POT/CV
// ---------------------------------------

let pot0_value = 0;
const pot0_channel = 0;

const pot0 = mcpadc.open(pot0_channel, err => {
    if (err) throw err;

    setInterval(_ => {
        pot0.read((err, reading) => {
            if (err) throw err;
            pot0_value = reading.value;
        });
    }, 100);

});

let varCV0_value = 0;
const varCV0_channel = 4;

const varCV0 = mcpadc.open(varCV0_channel, err => {
    if (err) throw err;

    setInterval(_ => {
        varCV0.read((err, reading) => {
            if (err) throw err;
            varCV0_value = reading.value;
            // console.log("valor agora do pin ", varCV0_channel, " - ", reading.value, " - ", reading.rawValue);
            actionCV0();
        });
    }, 100);

});

let computedValue0 = 0;

function actionCV0() {
    computedValue0 = Math.floor((pot0_value * varCV0_value) * 255);
    // console.log("pot", pot0_channel, " - ", pot0_value, "; CV", varCV0_channel, " - ", varCV0_value, "; computed - ", computedValue0)
    videoFiles[activeFilm].alphaValue = computedValue0;
    let changeAlpha = exec(motherFolder + "dbuscontrol.sh setalpha " + videoFiles[activeFilm].alphaValue + " " + activeFilm, function (err, stdout, stderr) {
        if (err) {
            // should have err.code here?
        }
        // console.log(stdout);
    });
}




// ---------------------------------------
// SECOND POT/CV
// ---------------------------------------
let pot1_value = 0;
const pot1_channel = 1;

const pot1 = mcpadc.open(pot1_channel, err => {
    if (err) throw err;

    setInterval(_ => {
        pot1.read((err, reading) => {
            if (err) throw err;
            pot1_value = reading.value;
        });
    }, 100);

});

let varCV1_value = 0;
const varCV1_channel = 5;

const varCV1 = mcpadc.open(varCV1_channel, err => {
    if (err) throw err;

    setInterval(_ => {
        varCV1.read((err, reading) => {
            if (err) throw err;
            varCV1_value = reading.value;
            // console.log("valor agora do pin ", varCV1_channel, " - ", reading.value, " - ", reading.rawValue);
            actionCV1();
        });
    }, 100);

});

let computedValue1 = 0;

function actionCV1() {
    computedValue1 = (pot1_value * varCV1_value) * 2.5;
    // console.log("pot", pot1_channel, " - ", pot1_value, "; CV", varCV1_channel, " - ", varCV1_value, "; computed - ", computedValue1)
    videoFiles[activeFilm].volume = computedValue1;
    let changeVol = exec(motherFolder + "dbuscontrol.sh volume " + computedValue1 + " " + activeFilm, function (err, stdout, stderr) {
        if (err) {
            // should have err.code here?
        }
        // console.log(stdout);
    });
}




// ---------------------------------------
// THIRD POT/CV
// ---------------------------------------
let pot2_value = 0;
const pot2_channel = 2;

const pot2 = mcpadc.open(pot2_channel, err => {
    if (err) throw err;

    setInterval(_ => {
        pot2.read((err, reading) => {
            if (err) throw err;
            pot2_value = reading.value;
        });
    }, 100);

});

let varCV2_value = 0;
const varCV2_channel = 6;

const varCV2 = mcpadc.open(varCV2_channel, err => {
    if (err) throw err;

    setInterval(_ => {
        varCV2.read((err, reading) => {
            if (err) throw err;
            varCV2_value = reading.value;
            // console.log("valor agora do pin ", varCV2_channel, " - ", reading.value, " - ", reading.rawValue);
            actionCV2();
        });
    }, 100);

});

let computedValue2 = 0;

function actionCV2() {
    computedValue2 = (pot2_value * varCV2_value) * 8;
    videoFiles[activeFilm].speed = computedValue2;
    // console.log("pot", pot2_channel, " - ", pot2_value, "; CV", varCV2_channel, " - ", varCV2_value, "; computed - ", computedValue2)
    let changeSpeed = exec(motherFolder + "dbuscontrol.sh rate " + videoFiles[activeFilm].speed + " " + activeFilm, function (err, stdout, stderr) {
        if (err) {
            // should have err.code here?
        }
        // console.log(stdout);
    });
}



// ---------------------------------------
// LAST/FOURTH POT/CV
// ---------------------------------------
let pot3_value = 0;
const pot3_channel = 3;

const pot3 = mcpadc.open(pot3_channel, err => {
    if (err) throw err;

    setInterval(_ => {
        pot3.read((err, reading) => {
            if (err) throw err;
            pot3_value = reading.value;
        });
    }, 100);

});

let varCV3_value = 0;
const varCV3_channel = 7;

const varCV3 = mcpadc.open(varCV3_channel, err => {
    if (err) throw err;

    setInterval(_ => {
        varCV3.read((err, reading) => {
            if (err) throw err;
            varCV3_value = reading.value;
            // console.log("valor agora do pin ", varCV3_channel, " - ", reading.value, " - ", reading.rawValue);
            actionCV3();
        });
    }, 100);

});

let computedValue3 = 0;

function actionCV3() {
    computedValue3 = (pot3_value * varCV3_value);
    // console.log("pot", pot3_channel, " - ", pot3_value, "; CV", varCV3_channel, " - ", varCV3_value, "; computed - ", computedValue3)
    videoFiles[activeFilm].startValue = computedValue3;
    // let changeAlpha = exec(motherFolder + "dbuscontrol.sh setalpha " + videoFiles[activeFilm].alphaValue + " " + activeFilm, function (err, stdout, stderr) {
    //     if (err) {
    //         // should have err.code here?
    //     }
    //     // console.log(stdout);
    // });
}



// ler triggers/gates/switches (botões e gates-por-cabo)
let rpio = require('rpio');

// // piDOWN:
// function pidown(pin) {
//     rpio.msleep(20);

//     if (rpio.read(pin))
//         return;


//     console.log('Button pressed on pin P%d', pin);
// }

// rpio.open(16, rpio.INPUT, rpio.PULL_UP);
// rpio.poll(16, pidown, rpio.POLL_LOW);


rpio.open(11, rpio.INPUT, rpio.PULL_UP);
rpio.open(8, rpio.OUTPUT);
rpio.open(10, rpio.OUTPUT);
rpio.open(12, rpio.OUTPUT);

// function pollcb(pin) {
//     /*
//      * Wait for a small period of time to avoid rapid changes which
//      * can't all be caught with the 1ms polling frequency.  If the
//      * pin is no longer down after the wait then ignore it.
//      */
//     rpio.msleep(20);

//     if (rpio.read(pin))
//         return;

//     console.log('Button pressed on pin P%d', pin);

//     if (videoFiles[activeFilm].screenMode > 0) {
//         videoFiles[activeFilm].screenMode = Math.floor(videoFiles[activeFilm].screenMode - 1);
//         console.log('change screenMode -- [', videoFiles[activeFilm], ']', screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' '));
//         let changeScreenMode = exec(motherFolder + "dbuscontrol.sh setvideopos " + screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' ') + " " + activeFilm, function (err, stdout, stderr) {
//             if (err) {
//                 // should have err.code here?
//             }
//             console.log(stdout);
//         });
//     } else {
//         console.log('screenMode is at min already...');
//         videoFiles[activeFilm].screenMode = Math.floor(screenModes - 1);
//         console.log('change screenMode deu a volta! [', videoFiles[activeFilm], ']', screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' '));
//         let changeScreenMode = exec(motherFolder + "dbuscontrol.sh setvideopos " + screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' ') + " " + activeFilm, function (err, stdout, stderr) {
//             if (err) {
//                 // should have err.code here?
//             }
//             console.log(stdout);
//         });

//     }

// }

// rpio.poll(11, pollcb, rpio.POLL_LOW);






// // physical pins // gpio pins 
const controlPin1 = 8; // 14
const controlPin2 = 10; // 15
const controlPin3 = 12; // 18
const readPin = 11; // 17

let valueChannel = {

    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
}



const onChange = require('on-change');
let i = 0;
const watchedObject = onChange(valueChannel, function (path, value, previousValue, applyData) {
    // console.log('Object changed:', ++i);
    // console.log('this:', this);
    // console.log('path:', path);
    // console.log('value:', value);
    // console.log('previousValue:', previousValue);
    // console.log('applyData:', applyData);

    // path = pinOrder! in this order: 
    // 0 - 1 - 2 -> upper three switches

    if (path === '0' && value === 1 && previousValue === 0) {
        // console.log('this:', this);
        console.log('killed active film!');
        destroyVideo(activeFilm);
    }

    if (videoFiles[activeFilm]) {

        if (path === '1' && value === 1 && previousValue === 0) {
            // console.log('this:', this);
            console.log('change anaglyph mode...');
            if (videoFiles[activeFilm].filterValue < maxanaglyph) {
                videoFiles[activeFilm].filterValue = Math.floor(videoFiles[activeFilm].filterValue + 1);
            } else {
                // console.log('anaglyph is at max already...');
                videoFiles[activeFilm].filterValue = 0;
                // console.log('change anaglyph deu a volta [', videoFiles[activeFilm], ']', videoFiles[activeFilm].filterValue);
            }
            // console.log('change anaglyph ++ [', videoFiles[activeFilm], ']');
        }
        if (path === '2' && value === 1 && previousValue === 0) {
            console.log('change screen position...');
            if (videoFiles[activeFilm].screenMode > 0) {
                videoFiles[activeFilm].screenMode = Math.floor(videoFiles[activeFilm].screenMode - 1);
                let changeAlpha = exec(motherFolder + "dbuscontrol.sh setvideopos " + screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' ') + " " + activeFilm, function (err, stdout, stderr) {
                    if (err) {
                        // should have err.code here?
                    }
                    console.log(stdout);
                });
            } else {
                // console.log('screenMode is at min already...');
                videoFiles[activeFilm].screenMode = Math.floor(screenModes - 1);
                // console.log('change screenMode deu a volta! [', videoFiles[activeFilm], ']', screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' '));
                let changeAlpha = exec(motherFolder + "dbuscontrol.sh setvideopos " + screenMode[videoFiles[activeFilm].screenMode][1].replace(/\,/g, ' ') + " " + activeFilm, function (err, stdout, stderr) {
                    if (err) {
                        // should have err.code here?
                    }
                    console.log(stdout);
                });

            }
            // console.log('change screenMode [', videoFiles[activeFilm], ']');
        }
        // 3 - 4 - 5 - 6 - 7 -> lower five switches
        if (path === '3' && value === 1 && previousValue === 0) {
            // console.log('this:', this);
            console.log('film 1 GO!');
            activeFilm = 0;
            createNewVideo(activeFilm);
        }
        if (path === '4' && value === 1 && previousValue === 0) {
            // console.log('this:', this);
            console.log('film 2 GO!');
            activeFilm = 1;
            createNewVideo(activeFilm);
        }
        if (path === '5' && value === 1 && previousValue === 0) {
            // console.log('this:', this);
            console.log('film 3 GO!');
            activeFilm = 2;
            createNewVideo(activeFilm);
        }
        if (path === '6' && value === 1 && previousValue === 0) {
            // console.log('this:', this);
            console.log('film 4 GO!');
            activeFilm = 3;
            createNewVideo(activeFilm);
        }
        if (path === '7' && value === 1 && previousValue === 0) {
            // console.log('this:', this);
            console.log('film 5 GO!');
            activeFilm = 4;
            createNewVideo(activeFilm);
        }
    }
});


// // função para ter um sleep em nodejs:
let sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// while (true) {
setInterval(_ => {

    for (let i = 0; i < 8; i++) {
        watchedObject[i] = readMux(i);
    }
    // console.log(watchedObject);
    // console.log("______________________");
}, 10);
// }

function readMux(channel) {
    const controlPin = { controlPin1, controlPin2, controlPin3 };

    const muxChannel = [
        [0, 0, 0], //channel 0
        [1, 0, 0], //channel 1
        [0, 1, 0], //channel 2
        [1, 1, 0], //channel 3
        [0, 0, 1], //channel 4
        [1, 0, 1], //channel 5
        [0, 1, 1], //channel 6
        [1, 1, 1], //channel 7
    ];

    //loop through the 3 sig
    // for (let i = 0; i < 3; i++) {
    //     console.log("pede para mudar...: ", muxChannel[channel][i]);
    //     //   digitalWrite(controlPin[i], muxChannel[channel][i]);
    // }
    rpio.write(controlPin1, muxChannel[channel][0] === 0 ? rpio.LOW : rpio.HIGH);
    rpio.write(controlPin2, muxChannel[channel][1] === 0 ? rpio.LOW : rpio.HIGH);
    rpio.write(controlPin3, muxChannel[channel][2] === 0 ? rpio.LOW : rpio.HIGH);

    //read the value at the readPin
    // let val = analogRead(readPin);
    // let returnedValue = console.log("pede para ler...: ", readPin);
    let returnedValue = rpio.read(readPin);

    // return the value
    // let voltage = (val * 5.0) / 1024.0;
    // return voltage;
    sleep(10);
    return returnedValue;
}
