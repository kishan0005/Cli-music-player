const { spawn } = require("child_process");
const path = require("path");

const VLC = "/Applications/VLC.app/Contents/MacOS/VLC";

const songs = [
    "song1.mp3",
    "song2.mp3"
];

const musicFolder = path.join(__dirname, "music");

let selectedSong = 0;
let playerProcess = null;
let paused = false;
function showMenu() {

    console.clear();

    console.log("=================================");
    console.log("       🎵 MUSIC PLAYER 🎵");
    console.log("=================================\n");

    songs.forEach((song, index) => {

        if (index === selectedSong) {
            console.log(`👉 ${song}`);
        } else {
            console.log(`   ${song}`);
        }

    });

    console.log("\n=================================");
    console.log("↑ ↓   Select");
    console.log("ENTER Play");
    console.log("P     Pause/Resume");
    console.log("S     Stop");
    console.log("Q     Quit");
    console.log("=================================");
}
function playSong() {

    // Stop previous VLC
    if (playerProcess) {
        playerProcess.kill();
        playerProcess = null;
    }

    const songPath = path.join(
        musicFolder,
        songs[selectedSong]
    );

    console.log(`\n▶ Playing: ${songs[selectedSong]}`);
    console.log(`File: ${songPath}`);

    playerProcess = spawn(
        VLC,
        [
            "--intf",
            "rc",
            songPath
        ],
        {
            stdio: ["pipe", "ignore", "pipe"]
        }
    );

    paused = false;

    playerProcess.on("error", (error) => {

        console.log("\n❌ VLC ERROR:");
        console.log(error.message);

    });

    playerProcess.stderr.on("data", (data) => {

        console.log(data.toString());

    });

    playerProcess.on("close", () => {

        playerProcess = null;
        paused = false;

        console.log("\nSong finished.");

    });
}
function togglePause() {

    if (!playerProcess) {

        console.log("\n❌ No song is playing.");

        return;
    }

    playerProcess.stdin.write("pause\n");

    paused = !paused;

    if (paused) {
        console.log("\n⏸ Paused");
    } else {
        console.log("\n▶ Resumed");
    }
}
function stopSong() {

    if (playerProcess) {

        playerProcess.kill();

        playerProcess = null;
        paused = false;

        console.log("\n⏹ Stopped");

    } else {

        console.log("\n❌ No song is playing.");

    }
}

process.stdin.setRawMode(true);
process.stdin.resume();

process.stdin.on("data", (key) => {

    if (key[0] === 3) {

        if (playerProcess) {
            playerProcess.kill();
        }

        process.exit(0);
    }
    if (
        key[0] === 27 &&
        key[1] === 91 &&
        key[2] === 65
    ) {

        selectedSong--;

        if (selectedSong < 0) {
            selectedSong = songs.length - 1;
        }

        showMenu();

    }
    else if (
        key[0] === 27 &&
        key[1] === 91 &&
        key[2] === 66
    ) {

        selectedSong++;

        if (selectedSong >= songs.length) {
            selectedSong = 0;
        }

        showMenu();

    }
    else if (key[0] === 13) {

        playSong();

    }

    else if (
        key[0] === 80 ||
        key[0] === 112
    ) {

        togglePause();

    }
    else if (
        key[0] === 83 ||
        key[0] === 115
    ) {

        stopSong();

    }
    else if (
        key[0] === 81 ||
        key[0] === 113
    ) {
        if (playerProcess) {
            playerProcess.kill();
        }

        console.log("\nGoodbye!");

        process.exit(0);
    }

});
showMenu();
