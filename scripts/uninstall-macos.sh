#!/bin/bash
set -euo pipefail

case "${1:-}" in
  '') clean=false ;;
  --clean-build) clean=true ;;
  --help)
    echo 'Usage: bash scripts/uninstall-macos.sh [--clean-build]'
    echo 'Remove Vite+/Rust installed by install-macos.sh, preserving pre-existing tools.'
    echo '--clean-build also deletes node_modules, dist, and src-tauri/target (including built apps).'
    exit 0 ;;
  *) echo "Unknown option: $1" >&2; exit 1 ;;
esac
[[ $# -le 1 ]] || { echo 'Too many arguments.' >&2; exit 1; }
[[ "$(uname -s)" == Darwin ]] || { echo 'This script requires macOS.' >&2; exit 1; }
[[ $EUID -ne 0 ]] || { echo 'Run this as your regular user, without sudo.' >&2; exit 1; }

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state_dir="$project_dir/.museeks-tools.local"

if [[ -f "$state_dir/vp-home" ]]; then
  vp_dir="$(cat "$state_dir/vp-home")"
  if [[ -x "$vp_dir/bin/vp" ]]; then
    echo "Removing the Vite+ installation created by this setup: $vp_dir"
    VP_HOME="$vp_dir" "$vp_dir/bin/vp" implode
    # A declined confirmation must retain the ownership record.
    if [[ ! -x "$vp_dir/bin/vp" ]]; then
      rm "$state_dir/vp-home"
    fi
  else
    echo "Vite+ executable unavailable at $vp_dir/bin/vp; retaining its record for manual cleanup."
  fi
else
  echo 'Leaving Vite+ alone: this setup did not install it.'
fi

if [[ -f "$state_dir/rust-cargo" && -f "$state_dir/rust-home" ]]; then
  cargo_dir="$(cat "$state_dir/rust-cargo")"
  rustup_dir="$(cat "$state_dir/rust-home")"
  if [[ -x "$cargo_dir/bin/rustup" ]]; then
    echo "Removing the Rust installation created by this setup: $rustup_dir"
    CARGO_HOME="$cargo_dir" RUSTUP_HOME="$rustup_dir" "$cargo_dir/bin/rustup" self uninstall
    if [[ ! -x "$cargo_dir/bin/rustup" ]]; then
      rm "$state_dir/rust-cargo" "$state_dir/rust-home"
    fi
  else
    echo 'Rustup executable unavailable; retaining its records for manual cleanup.'
  fi
else
  echo 'Leaving Rust alone: this setup did not install it.'
fi

if $clean; then
  echo 'Removing project dependencies and build output (including apps inside target)...'
  rm -rf "$project_dir/node_modules" "$project_dir/dist" "$project_dir/src-tauri/target"
fi
rmdir "$state_dir" 2>/dev/null || true
echo 'Finished. Xcode Command Line Tools and apps copied to Applications are preserved.'
echo 'Open a new Terminal to refresh your PATH.'
