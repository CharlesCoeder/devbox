FROM debian:bookworm

ARG USER_ID=501
ARG GROUP_ID=20
ARG NODE_VERSION=22

# ── System dependencies ──────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core tools
    git curl wget jq ca-certificates \
    # Build essentials
    build-essential pkg-config libssl-dev \
    # Python
    python3 python3-pip python3-venv \
    # Search & nav
    ripgrep fzf \
    # Editors & pagers
    vim nano less \
    # Network tools
    iputils-ping dnsutils netcat-openbsd \
    # Misc
    procps xdg-utils unzip zip sudo \
    && rm -rf /var/lib/apt/lists/*

# ── GitHub CLI ────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends gnupg && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] \
      https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && apt-get install -y --no-install-recommends gh && \
    rm -rf /var/lib/apt/lists/*

# ── Create dev user matching host UID/GID ─────────────────────────────
RUN groupadd -g $GROUP_ID dev 2>/dev/null || true && \
    useradd -m -u $USER_ID -g $GROUP_ID -s /bin/bash dev && \
    echo "dev ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/dev

# ── Everything below runs as dev (non-root) ───────────────────────────
USER dev

# ── Node.js via nvm ──────────────────────────────────────────────────
ENV NVM_DIR=/home/dev/.nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && \
    . "$NVM_DIR/nvm.sh" && \
    nvm install $NODE_VERSION && \
    nvm alias default $NODE_VERSION

# ── Claude Code CLI ──────────────────────────────────────────────────
RUN . "$NVM_DIR/nvm.sh" && npm install -g @anthropic-ai/claude-code

# ── Rust toolchain ───────────────────────────────────────────────────
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    --default-toolchain stable --profile minimal

# ── JS tooling ───────────────────────────────────────────────────────
RUN . "$NVM_DIR/nvm.sh" && \
    corepack enable && corepack prepare yarn@4.5.0 --activate && \
    npm install -g turbo typescript @biomejs/biome vercel

# ── Shell config ─────────────────────────────────────────────────────
RUN echo '. "$NVM_DIR/nvm.sh"' >> /home/dev/.bashrc && \
    echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> /home/dev/.bashrc

# ── Pre-create mount targets so named volumes inherit dev ownership ──
RUN mkdir -p /home/dev/.claude /home/dev/.cursor-server /home/dev/.cache

WORKDIR /home/dev/workspace

CMD ["bash"]
