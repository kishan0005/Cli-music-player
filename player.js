const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const VLC = "/Applications/VLC.app/Contents/MacOS/VLC";
const MUSIC = path.join(__dirname, "music");
const AUDIO_TYPES = new Set([".mp3", ".m4a", ".wav", ".aac", ".flac", ".ogg"]);

const cyan = "\x1b[36m";
const magenta = "\x1b[35m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";
const blue = "\x1b[34m";
const white = "\x1b[37m";
const black = "\x1b[30m";
const bold = "\x1b[1m";
const dim = "\x1b[2m";
const reset = "\x1b[0m";

const moods = {
    all: {
        label: "All Songs",
        icon: "♫",
        color: cyan,
        keywords: []
    },
    energy: {
        label: "Energy",
        icon: "🔥",
        color: red,
        keywords: ["energy", "party", "dance", "beat", "rock", "fire", "fast", "bass"]
    },
    chill: {
        label: "Chill",
        icon: "😌",
        color: cyan,
        keywords: ["chill", "calm", "lofi", "soft", "slow", "relax", "peace"]
    },
    romantic: {
        label: "Romantic",
        icon: "❤️",
        color: magenta,
        keywords: ["love", "romantic", "heart", "dream", "forever", "kiss"]
    },
    night: {
        label: "Night",
        icon: "🌙",
        color: blue,
        keywords: ["night", "moon", "dark", "late", "midnight", "sleep"]
    }
};

let library = loadLibrary();
let playlist = [...library];
let playlistName = "All Songs";
let activeMood = "all";
let index = 0;
let player = null;
let paused = false;
let shuffle = false;
let repeat = false;
let dark = true;
let elapsed = 0;
let animation = 0;
let manualStop = false;

const favourites = new Set();

function loadLibrary() {
    if (!fs.existsSync(MUSIC)) {
        fs.mkdirSync(MUSIC);
    }

    return fs.readdirSync(MUSIC)
        .filter(file => AUDIO_TYPES.has(path.extname(file).toLowerCase()))
        .sort((a, b) => a.localeCompare(b))
        .map((file, songIndex) => ({
            id: file,
            file,
            title: cleanTitle(file),
            path: path.join(MUSIC, file),
            mood: detectMood(file),
            duration: 180 + ((songIndex * 37) % 120)
        }));
}

function cleanTitle(file) {
    return path.basename(file, path.extname(file))
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function detectMood(file) {
    const name = cleanTitle(file).toLowerCase();

    for (const [moodName, moodData] of Object.entries(moods)) {
        if (moodName !== "all" && moodData.keywords.some(word => name.includes(word))) {
            return moodName;
        }
    }

    return "all";
}

function currentSong() {
    return playlist[index] || null;
}

function currentSongId() {
    return currentSong()?.id;
}

function clampIndex() {
    if (!playlist.length) {
        index = 0;
        return;
    }

    index = Math.max(0, Math.min(index, playlist.length - 1));
}

function time(sec) {
    sec = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

function progressBar() {
    const width = 30;
    const song = currentSong();
    const duration = song?.duration || 0;
    const percent = duration ? Math.min(1, elapsed / duration) : 0;
    const position = Math.min(width - 1, Math.floor(percent * width));
    let bar = "";

    for (let i = 0; i < width; i++) {
        if (i === position) {
            bar += cyan + "●" + reset;
        } else if (i < position) {
            bar += magenta + "━" + reset;
        } else {
            bar += dim + "─" + reset;
        }
    }

    return bar;
}

function visualizer() {
    if (!player || paused) {
        return "▁ ▂ ▃ ▄ ▃ ▂";
    }

    const frames = [
        "▂ ▅ ▇ ▃ ▆ ▂",
        "▆ ▂ ▅ ▇ ▃ ▆",
        "▇ ▅ ▂ ▆ ▃ ▇",
        "▃ ▇ ▆ ▂ ▅ ▃",
        "▅ ▃ ▆ ▇ ▂ ▅"
    ];

    return frames[animation % frames.length];
}

function modeText(value, onText = "ON", offText = "OFF") {
    return value ? green + onText + reset : dim + offText + reset;
}

function render() {
    const bg = dark ? "\x1b[40m" : "\x1b[47m";
    const text = dark ? white : black;
    const song = currentSong();
    const duration = song?.duration || 0;
    const percent = duration ? Math.min(100, Math.floor((elapsed / duration) * 100)) : 0;
    const status = !player ? yellow + "■ STOPPED" : paused ? yellow + "Ⅱ PAUSED" : green + "● PLAYING";
    const moodData = moods[activeMood] || moods.all;
    const favouriteMark = song && favourites.has(song.id) ? red + "♥️" + reset : dim + "♡" + reset;

    const screen = `
${cyan}${bold}╭────────────────────────────────────────────────────────╮
│                                                        │
│                 🎧  V I B E C L I                    │
│              Terminal Music Player                    │
│                                                        │
╰────────────────────────────────────────────────────────╯${reset}

${magenta}NOW PLAYING${reset}
  ${song ? yellow + song.title + reset : red + "No songs found in ./music" + reset}
  ${song ? dim + song.file + reset : dim + "Add audio files to the music folder and press x to refresh." + reset}

  ${status}${reset}    ${favouriteMark}    ${moodData.color}${moodData.icon} ${moodData.label}${reset}

        ${cyan}${visualizer()}${reset}

  ${green}${time(elapsed)}${reset}  ${progressBar()}  ${blue}${time(duration)}${reset}
                         ${cyan}${percent}%${reset}

  ${blue}b${reset} Previous   ${blue}p${reset} Play/Pause   ${blue}n${reset} Next   ${blue}s${reset} Stop
  ${yellow}←/→${reset} Skip 10s     ${yellow}↑/↓${reset} Select song     ${yellow}Enter${reset} Play selected

${magenta}────────────────────────────────────────────────────────${reset}
  ${cyan}Shuffle${reset} ${modeText(shuffle)}     ${cyan}Repeat${reset} ${modeText(repeat)}     ${cyan}Theme${reset} ${dark ? "🌙 DARK" : "☀️ LIGHT"}
  ${cyan}Favourite${reset} ${song && favourites.has(song.id) ? red + "YES" + reset : dim + "NO" + reset}     ${cyan}Playlist${reset} ${green}${playlistName}${reset}

${magenta}────────────────────────────────────────────────────────${reset}
${cyan}PLAYLIST${reset}
${buildPlaylistLines(text)}

${magenta}────────────────────────────────────────────────────────${reset}
  ${dim}/ search   m mood   f favourite   r shuffle   l repeat   t theme   a all   v favourites   x refresh   q quit${reset}
`;

    process.stdout.write("\x1b[2J\x1b[H");
    process.stdout.write(bg + text + screen + reset);
}

function buildPlaylistLines(text) {
    if (!library.length) {
        return `  ${dim}The music folder is empty.${reset}`;
    }

    if (!playlist.length) {
        return `  ${dim}This playlist has no songs. Press a for all songs.${reset}`;
    }

    const start = Math.max(0, Math.min(index - 4, Math.max(0, playlist.length - 9)));
    const shown = playlist.slice(start, start + 9);

    return shown.map((song, offset) => {
        const actualIndex = start + offset;
        const selected = actualIndex === index;
        const moodData = moods[song.mood] || moods.all;
        const heart = favourites.has(song.id) ? red + " ♥️" + reset : "";
        const number = String(actualIndex + 1).padStart(2, "0");

        if (selected) {
            return `  ${cyan}➜ ${number}. ${song.title}${heart} ${moodData.icon}${reset}`;
        }

        return `    ${dim}${number}.${reset} ${text}${song.title}${reset}${heart} ${moodData.icon}`;
    }).join("\n");
}

function play() {
    const song = currentSong();

    if (!song) {
        render();
        return;
    }

    if (player) {
        manualStop = true;
        player.kill();
    }

    player = spawn(VLC, ["--intf", "rc", "--quiet", song.path], {
        stdio: ["pipe", "ignore", "ignore"]
    });

    paused = false;
    elapsed = 0;
    manualStop = false;

    player.on("error", error => {
        player = null;
        process.stdout.write("\x1b[2J\x1b[H");
        console.log(red + "Could not start VLC." + reset);
        console.log(dim + error.message + reset);
        console.log("\nInstall VLC or update the VLC path in music_playr.cjs.");
        process.exitCode = 1;
    });

    player.on("close", () => {
        player = null;

        if (manualStop) {
            manualStop = false;
            return;
        }

        if (repeat) {
            play();
        } else {
            next();
        }
    });

    render();
}

function pause() {
    if (!player) {
        play();
        return;
    }

    player.stdin.write("pause\n");
    paused = !paused;
    render();
}

function stop() {
    stopWithoutRender();
    render();
}

function stopWithoutRender() {
    if (player) {
        manualStop = true;
        player.kill();
        player = null;
    }

    paused = false;
    elapsed = 0;
}

function next() {
    if (!playlist.length) {
        render();
        return;
    }

    if (shuffle && playlist.length > 1) {
        let nextIndex = index;
        while (nextIndex === index) {
            nextIndex = Math.floor(Math.random() * playlist.length);
        }
        index = nextIndex;
    } else {
        index = (index + 1) % playlist.length;
    }

    play();
}

function previous() {
    if (!playlist.length) {
        render();
        return;
    }

    index = (index - 1 + playlist.length) % playlist.length;
    play();
}

function skip(seconds) {
    if (!player) return;

    player.stdin.write(`seek ${seconds}\n`);
    elapsed = Math.max(0, Math.min(currentSong()?.duration || elapsed, elapsed + seconds));
    render();
}

function toggleFavourite() {
    const id = currentSongId();

    if (!id) {
        render();
        return;
    }

    if (favourites.has(id)) {
        favourites.delete(id);
    } else {
        favourites.add(id);
    }

    if (playlistName === "Favourites") {
        playlist = library.filter(song => favourites.has(song.id));
        clampIndex();
    }

    render();
}

function setPlaylist(songs, name, moodName = activeMood) {
    stopWithoutRender();
    playlist = songs;
    playlistName = name;
    activeMood = moodName;
    index = 0;
    elapsed = 0;
    clampIndex();
    render();
}

function showAllSongs() {
    setPlaylist([...library], "All Songs", "all");
}

function showFavourites() {
    const favouriteSongs = library.filter(song => favourites.has(song.id));
    setPlaylist(favouriteSongs, "Favourites", activeMood);
}

function refreshLibrary() {
    const selectedId = currentSongId();

    stopWithoutRender();
    library = loadLibrary();
    playlist = [...library];
    playlistName = "All Songs";
    activeMood = "all";
    index = playlist.findIndex(song => song.id === selectedId);

    if (index === -1) {
        index = 0;
    }

    clampIndex();
    render();
}

function ask(title, body, prompt, onAnswer) {
    process.stdin.setRawMode(false);
    process.stdout.write("\x1b[2J\x1b[H");
    console.log(title);
    console.log(body);
    process.stdout.write(prompt);

    process.stdin.once("data", data => {
        onAnswer(data.toString().trim());
        process.stdin.setRawMode(true);
        process.stdin.resume();
    });
}

function search() {
    ask(
        `${cyan}╭────────────────────────────────────╮\n│             🔍 SEARCH              │\n╰────────────────────────────────────╯${reset}`,
        `${dim}Search by song name. Matching results become the playlist.${reset}\n`,
        "Search: ",
        query => {
            const cleanQuery = query.toLowerCase();

            if (!cleanQuery) {
                showAllSongs();
                return;
            }

            const results = library.filter(song =>
                song.title.toLowerCase().includes(cleanQuery) ||
                song.file.toLowerCase().includes(cleanQuery)
            );

            setPlaylist(results, `Search: ${query}`, activeMood);
        }
    );
}

function mood() {
    const menu = Object.entries(moods)
        .map(([key, data], number) => `  ${yellow}${number + 1}${reset}. ${data.color}${data.icon} ${data.label}${reset} ${dim}(${key})${reset}`)
        .join("\n");

    ask(
        `${magenta}╭────────────────────────────────────╮\n│              🧠 MOOD               │\n╰────────────────────────────────────╯${reset}`,
        `${menu}\n\n${dim}Mood uses words in file names like chill, love, night, party, beat.${reset}\n`,
        "Choose mood number: ",
        answer => {
            const moodKeys = Object.keys(moods);
            const moodName = moodKeys[Number(answer) - 1];

            if (!moodName || moodName === "all") {
                showAllSongs();
                return;
            }

            const results = library.filter(song => song.mood === moodName);
            setPlaylist(results, moods[moodName].label, moodName);
        }
    );
}

process.stdin.setRawMode(true);
process.stdin.resume();

process.stdin.on("data", key => {
    if (key[0] === 3) {
        stopWithoutRender();
        process.exit();
    }

    if (key[0] === 27 && key[2] === 65) {
        index = (index - 1 + playlist.length) % Math.max(playlist.length, 1);
        render();
    }

    if (key[0] === 27 && key[2] === 66) {
        index = (index + 1) % Math.max(playlist.length, 1);
        render();
    }

    if (key[0] === 27 && key[2] === 68) skip(-10);
    if (key[0] === 27 && key[2] === 67) skip(10);

    if (key[0] === 13) play();
    if (key[0] === 112) pause();
    if (key[0] === 115) stop();
    if (key[0] === 110) next();
    if (key[0] === 98) previous();

    if (key[0] === 114) {
        shuffle = !shuffle;
        render();
    }

    if (key[0] === 108) {
        repeat = !repeat;
        render();
    }

    if (key[0] === 102) toggleFavourite();
    if (key[0] === 47) search();
    if (key[0] === 109) mood();

    if (key[0] === 100 || key[0] === 116) {
        dark = !dark;
        render();
    }

    if (key[0] === 97) showAllSongs();
    if (key[0] === 118) showFavourites();
    if (key[0] === 120) refreshLibrary();

    if (key[0] === 113) {
        stopWithoutRender();
        process.exit();
    }
});

setInterval(() => {
    const song = currentSong();

    if (player && !paused) {
        elapsed++;
        animation++;

        if (song && elapsed >= song.duration) {
            elapsed = song.duration;
        }

        render();
    }
}, 1000);

render();
