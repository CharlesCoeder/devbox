#!/usr/bin/env bash
# ==============================================================================
#  devbox installer
#
#  Installs the devbox CLI and optionally sets up the Raycast extension.
#
#  Usage:
#    curl -fsSL https://raw.githubusercontent.com/<user>/devbox/main/install.sh | bash
#    # or from a local clone:
#    ./install.sh
# ==============================================================================

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
    RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; BLUE=$'\033[0;34m'
    CYAN=$'\033[0;36m'; BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
    RED='' GREEN='' BLUE='' CYAN='' BOLD='' DIM='' RESET=''
fi

info() { printf "${BLUE}::${RESET} %s\n" "$*"; }
success() { printf "${GREEN}✓${RESET} %s\n" "$*"; }
die() { printf "${RED}error:${RESET} %s\n" "$*" >&2; exit 1; }

# ── Detect source ────────────────────────────────────────────────────
REPO_DIR=""
if [[ -f "${BASH_SOURCE[0]}" ]]; then
    SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "${SCRIPT_PATH}/bin/devbox" ]]; then
        REPO_DIR="$SCRIPT_PATH"
    fi
fi

# If running from curl pipe, clone the repo
if [[ -z "$REPO_DIR" ]]; then
    if ! command -v git >/dev/null 2>&1; then
        die "git is required for installation"
    fi
    REPO_DIR="${HOME}/.local/share/devbox/repo"
    info "Cloning devbox repository..."
    mkdir -p "$(dirname "$REPO_DIR")"
    if [[ -d "$REPO_DIR" ]]; then
        git -C "$REPO_DIR" pull --quiet
    else
        git clone https://github.com/charlier/devbox.git "$REPO_DIR"
    fi
fi

# ── Install CLI ──────────────────────────────────────────────────────
BIN_DIR="${HOME}/.local/bin"
CONFIG_DIR="${HOME}/.config/devbox"

mkdir -p "$BIN_DIR" "$CONFIG_DIR"

# Symlink the CLI script
ln -sf "${REPO_DIR}/bin/devbox" "${BIN_DIR}/devbox"
chmod +x "${REPO_DIR}/bin/devbox"

# Copy Dockerfile to config dir
cp "${REPO_DIR}/build/Dockerfile" "${CONFIG_DIR}/Dockerfile"

success "Installed devbox to ${BIN_DIR}/devbox"

# ── Install zsh completions ─────────────────────────────────────────
COMP_DIR="${HOME}/.local/share/devbox/completions"
mkdir -p "$COMP_DIR"
cp "${REPO_DIR}/completions/_devbox" "$COMP_DIR/_devbox"

# Add completion to .zshrc if not already present
COMP_LINE='fpath=(${HOME}/.local/share/devbox/completions $fpath)'
if [[ -f "${HOME}/.zshrc" ]] && ! grep -qF '.local/share/devbox/completions' "${HOME}/.zshrc" 2>/dev/null; then
    printf '\n# devbox completions\n%s\nautoload -Uz compinit && compinit\n' "$COMP_LINE" >> "${HOME}/.zshrc"
    success "Added zsh completions (restart your shell or run: source ~/.zshrc)"
else
    success "Zsh completions installed"
fi

# ── Check PATH ───────────────────────────────────────────────────────
if ! echo "$PATH" | tr ':' '\n' | grep -q "${BIN_DIR}"; then
    printf "\n"
    printf "${YELLOW}Note:${RESET} %s is not in your PATH.\n" "$BIN_DIR"
    printf "Add this to your shell profile (~/.zshrc or ~/.bashrc):\n\n"
    printf "  export PATH=\"\${HOME}/.local/bin:\${PATH}\"\n\n"
fi

# ── Build Docker image ──────────────────────────────────────────────
if command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
        info "Building devbox Docker image..."
        "${BIN_DIR}/devbox" build
    else
        info "Docker is installed but not running. Run ${BOLD}devbox build${RESET} after starting Docker."
    fi
else
    info "Docker not found. Install Docker Desktop, then run ${BOLD}devbox build${RESET}."
fi

# ── Raycast extension ───────────────────────────────────────────────
if [[ -d "/Applications/Raycast.app" ]]; then
    printf "\n"
    info "Raycast detected. To install the devbox extension:"
    printf "  cd %s/extensions/raycast && npm install && npm run dev\n" "$REPO_DIR"
fi

printf "\n"
success "Installation complete! Run ${BOLD}devbox help${RESET} to get started."
