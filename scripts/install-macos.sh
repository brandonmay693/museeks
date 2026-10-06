#!/bin/bash
set -euo pipefail

case "${1:-}" in
  '') build=false ;;
  --build) build=true ;;
  --help)
    echo 'Usage: bash scripts/install-macos.sh [--build]'
    echo 'Install missing build tools and project dependencies; optionally build Museeks.'
    exit 0 ;;
  *) echo "Unknown option: $1" >&2; exit 1 ;;
esac
[[ $# -le 1 ]] || { echo 'Too many arguments.' >&2; exit 1; }
[[ "$(uname -s)" == Darwin ]] || { echo 'This script requires macOS.' >&2; exit 1; }
[[ $EUID -ne 0 ]] || { echo 'Run this as your regular user, without sudo.' >&2; exit 1; }

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state_dir="$project_dir/.museeks-tools.local"
mkdir -p "$state_dir"
cd "$project_dir"

# Apple's installer is interactive. A second run resumes the remaining setup.
if ! xcrun --find clang >/dev/null 2>&1 || ! xcrun --show-sdk-path >/dev/null 2>&1; then
  xcode-select --install || true
  echo 'Complete the Apple Command Line Tools installation, then run this script again.'
  exit 1
fi

cargo_dir="${CARGO_HOME:-$HOME/.cargo}"
rustup_dir="${RUSTUP_HOME:-$HOME/.rustup}"
export PATH="$cargo_dir/bin:${VP_HOME:-$HOME/.vite-plus}/bin:${VP_BIN_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/vite-plus/bin}:$PATH"
download_dir="$(mktemp -d "${TMPDIR:-/tmp}/museeks-install.XXXXXX")"
trap 'rm -rf "$download_dir"' EXIT

if ! command -v cargo >/dev/null 2>&1; then
  if [[ -f "$state_dir/rust-cargo" ]] && { [[ "$(cat "$state_dir/rust-cargo")" != "$cargo_dir" ]] || [[ "$(cat "$state_dir/rust-home")" != "$rustup_dir" ]]; }; then
    echo 'Rust paths changed since setup. Uninstall the recorded tools before using different paths.' >&2
    exit 1
  fi
  if [[ ! -f "$state_dir/rust-cargo" ]] && { [[ -e "$cargo_dir" ]] || [[ -e "$rustup_dir" ]] || command -v rustup >/dev/null 2>&1; }; then
    echo 'An existing Rust installation was found but cargo is unavailable. Restore its PATH/toolchain first.' >&2
    exit 1
  fi
  echo 'Installing Rust with rustup...'
  curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs -o "$download_dir/rustup.sh"
  # Record ownership before execution so interrupted installations can be cleaned up.
  printf '%s\n' "$cargo_dir" > "$state_dir/rust-cargo"
  printf '%s\n' "$rustup_dir" > "$state_dir/rust-home"
  bash "$download_dir/rustup.sh" -y --profile minimal
else
  echo 'Using existing Rust installation.'
fi
cargo --version

if ! command -v vp >/dev/null 2>&1; then
  vp_dir="${VP_HOME:-$HOME/.vite-plus}"
  if [[ -f "$state_dir/vp-home" && "$(cat "$state_dir/vp-home")" != "$vp_dir" ]]; then
    echo 'Vite+ path changed since setup. Uninstall the recorded tools before using a different path.' >&2
    exit 1
  fi
  if [[ ! -f "$state_dir/vp-home" ]] && { [[ -e "$vp_dir" ]] || [[ -e "${XDG_DATA_HOME:-$HOME/.local/share}/vite-plus" ]]; }; then
    echo 'An existing Vite+ installation was found but vp is unavailable. Restore its PATH first.' >&2
    exit 1
  fi
  echo 'Installing Vite+...'
  curl --proto '=https' --tlsv1.2 -fsSL https://vite.plus -o "$download_dir/vp.sh"
  printf '%s\n' "$vp_dir" > "$state_dir/vp-home"
  export VP_HOME="$vp_dir"
  bash "$download_dir/vp.sh"
else
  echo 'Using existing Vite+ installation.'
fi
vp --version
vp install

if $build; then
  vp run gen:translations
  vp run tauri build
  echo 'Build complete. Copy Museeks.app to Applications before cleaning build files.'
  echo "Bundles: $project_dir/src-tauri/target/release/bundle/"
else
  echo 'Setup complete. Open a new Terminal, then run: vp run tauri dev'
  echo 'Or rerun this script with --build to create a standalone app.'
fi
