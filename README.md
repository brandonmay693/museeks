# Museeks

![build](https://github.com/martpie/museeks/actions/workflows/build.yml/badge.svg?branch=master)
![GitHub All Releases](https://img.shields.io/github/downloads/martpie/museeks/total)

A simple, clean, and cross-platform music player. ([museeks.io](https://museeks.io))

![Screenshot](screenshot.png)

## Features

Museeks aims to be a simple and easy-to-use music player with a clean UI. You will not find tons of features, as its goal is not to compete with more complete and more famous music players.

Here is a little preview though:

- 💻 Cross-platform music player (Linux, macOS, and Windows)
- 🎧 Supported formats: mp3, mp4, m4a/aac, flac, wav, ogg, 3gpp
- 🔄 Library auto-refresh
- 🌟 Playlists
- 🎼 Queue management
- ➰ Shuffle, loop
- 🌄 Cover art
- 🤓 Dark theme
- 🚤 Playback speed control
- 😴 Sleep mode blocker
- 📥 `.m3u` import/export

Want more? Open a new issue or 👍 an existing one so we can talk about it.

## Installation

Binaries/Installers can be found [on the releases page](https://github.com/martpie/museeks/releases).

> [!NOTE]
> The publication of Museeks to package managers is community-maintained. Museeks may be available there (like Homebrew, AUR, etc.), but there is no guarantee it will be the latest version.

## Release Notes

[Over here!](https://github.com/martpie/museeks/releases)

## Bugs

Please open an issue on GitHub, mention your OS, your Museeks version, and how to reproduce it. Adding a screenshot of the console (Menu -> View -> Toggle Developer Tools) is a big help too.

Thank you!

## Troubleshooting

Since version `0.20`, I try to keep things as backwards-compatible as possible, but I may miss some edge cases.

If you encounter freezes or crashes when using the app, you can reset Museeks.

<details>
  <summary>Reset Museeks</summary>

- Go to Settings -> Open Storage Directory
- Alternatively, go to the Museeks folder directly:
  - Windows: `%AppData%\museeks`
  - macOS: `~/Library/Application Support/museeks`
  - Linux: `~/.config/museeks/` or `$XDG_CONFIG_HOME/museeks`
- Delete everything there
- Restart Museeks

</details>

If you still have problems after that, please open an issue :)

## Genre and energy tagging on macOS

While a track is loaded, use the energy dropdown beside the playback display to
assign a level or choose **Energy: untagged** to clear it. It also works while
paused and with files opened directly from an external drive.

The genre dropdown to its left assigns a separate Finder tag, such as
`Museeks Genre Tech House`. Choose **Genre: untagged** to remove that genre
assignment. Genre and energy are independent: changing either preserves the
other, along with your existing Finder tags and colors. The genre selection does
not overwrite the file's embedded genre metadata.

For a global energy Smart Folder, match `Museeks Energy 07`. For an energy folder
within a genre, add a second Tags condition matching `Museeks Genre Tech House`
and require **all** conditions to match. The same file can appear in both saved
searches without being copied or moved.

Rekordbox has its own Genre and My Tag filters, but these Finder tags are not
automatically synchronized into those fields. Use the saved searches to select
tracks for import into rekordbox playlists.

The scale runs from 1 (ambient) to 10 (maximum), following the
[1–10 energy scale used by Mixed In Key](https://mixedinkey.com/workflows/use-energy-level-detection/).
The descriptive labels are listening guides chosen for Museeks, not automatic
analysis or Mixed In Key's classifications. Judge perceived intensity rather than
BPM alone: 1–3 for quieter selections, 4–6 for warm-up and groove, and 7–10 for
high-energy and peak-time tracks.

Your choice is saved on the original file as a Finder tag such as
`Museeks Energy 07`. Other Finder tags and their colors are preserved. Music files
stay in their album folders, and their audio contents are unchanged. These tags
are macOS file metadata, not embedded ID3 tags or rekordbox energy metadata.

To organize and import your selections:

1. In Finder, choose **File > New Smart Folder**. Select the external drive as the
   search scope, or **This Mac** to include indexed locations.
2. Add a **Tags** search criterion (under **Other…** if needed) matching
   `Museeks Energy 07`. Save it as something like **Energy 07** and add it to the
   sidebar. Repeat for the levels you use.
3. Open the saved Smart Folder, select its tracks, and drag them into a named
   playlist in rekordbox. Use rekordbox's automatic analysis setting or select the
   imported tracks and choose **Analyze Track**.
4. Return to the Smart Folder as your tagged collection grows and import new
   selections. Finder updates the search results; it does not synchronize a
   rekordbox playlist automatically.

A Smart Folder is a saved search, not a regular directory: drag its **matching
tracks**, rather than assuming rekordbox can import the `.savedSearch` file.
Keep the drive connected and file paths stable for playback in rekordbox.

The drive must support writable extended attributes, and Spotlight must index it
for Smart Folder results to appear. If tagging fails, Museeks displays an error;
it does not silently save an app-only rating. A disconnected/read-only drive can
be retried after reconnecting or restoring write access. Copies to other file
systems or transfers through non-Mac tools may not preserve Finder tags.

See Apple's [Smart Folder instructions](https://support.apple.com/guide/mac-help/mchlp2804/mac)
and the [rekordbox manual](https://cdn.rekordbox.com/files/20260409151936/rekordbox7.214_manual_EN.pdf).

## Contributing and Development

### Guidelines

- Before making complex changes, don't hesitate to open an issue first to discuss it ;)
- Understandable code > short code: comment if needed
- That's it :)

### Setup

On macOS, you can install the tools and build a standalone app with:

```bash
bash scripts/install-macos.sh --build
```

If Apple's Command Line Tools installer opens, finish it and rerun the command.
Omit `--build` to install tools and dependencies only. The script reuses existing
Rust and Vite+ installations, and records tools it installs in the ignored
`.museeks-tools.local` directory. Keep that directory until uninstalling.
Installers may update your shell configuration; open a new Terminal afterward.

Copy the built `Museeks.app` from `src-tauri/target/release/bundle/macos/` into
Applications. You can then remove the tools installed by the script:

```bash
bash scripts/uninstall-macos.sh
```

The official uninstallers ask for confirmation. This removes the recorded Rust
and Vite+ installations, including their managed data, so keep them if you now use
them for other projects. Tools that were already installed and Apple's Command
Line Tools are preserved. To also remove project dependencies and build output,
use `--clean-build`; copy the app to Applications first because this deletes
`src-tauri/target`, along with `node_modules` and `dist`.

For manual setup:

Museeks is built upon:

- Back-end: [Tauri v2](https://v2.tauri.app/) / Rust 🦀
- UI: [React.js](https://react.dev)

So you will need to install the following dependencies:

- [Tauri requirements](https://v2.tauri.app/start/prerequisites/) for `rust`
- [`vp` (Vite+)](https://viteplus.dev/guide/) for the frontend toolchain (handles Node.js, dependencies, and build tools)

Then you can:

- Fork the repository
- `git clone git@github.com:<username>/museeks.git`
- `cd museeks`
- `vp env use` to setup Node.js and the package manager

### Development Mode

- `vp install`
- `vp run tauri dev`

This will launch Museeks in dev mode. Hot reload will work out-of-the-box, so when you update a `.js` file, the UI will automatically update. When you edit a `.rs` file, Museeks will automatically rebuild.

### Package Binaries

- `vp install`
- `vp run tauri build`

Tauri does not support cross-platform binaries, so the command will only generate binaries for your current platform (macOS, Linux, or Windows).

### Translations

- Follow the steps from the "Setup" and "Development Mode" sections
- Go to `src/translations/languages.ts`
- Add your language information to the list
- Run `vp run gen:translations`
- This will create a new file `<your_language_code>.po` in the same folder
- Fill in the translations from the created `.po` file
- Open a Pull Request

<details>
  <summary>Pluralization Help</summary>

- [Pluralization guide](https://lingui.dev/guides/plurals)
- [Pluralization reference](https://www.unicode.org/cldr/charts/42/supplemental/language_plural_rules.html)

</details>

ps: _Translations are in an early stage. If your language has "special" characteristics, like right-to-left, specific locales instead of languages, or something else, Museeks might not be ready for it yet. Please open an issue to discuss it!_
