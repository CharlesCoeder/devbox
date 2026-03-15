# Antigravity Dev Container Support

## Current status (as of AG v1.107.0, March 2026)

Antigravity (Google's VS Code fork) **cannot programmatically open a project inside a dev container**. We tried three approaches — all failed:

1. **`vscode-remote://attached-container+hex` URI** — AG doesn't register a handler for this protocol. Error: "No remote extension installed to resolve attached-container."

2. **`.devcontainer/devcontainer.json` + auto-reopen** — AG has built-in Dev Containers but there's no setting or CLI flag to auto-reopen in container mode. It opens the folder locally and waits for the user to manually click "Reopen in Container" (if it even prompts).

3. **AG CLI (`antigravity --folder-uri`)** — The `--folder-uri` flag doesn't exist in AG's CLI. There's no way to pass a remote URI.

## Current approach

**Antigravity opens the project folder locally on the host.** Since devbox bind-mounts the host directory into the container, the files are identical — edits in AG are instantly visible inside the devbox container and vice versa.

What you lose: AG extensions/linting run on the host, not inside the container. For running commands (dev servers, tests, Claude Code), use the devbox container via terminal.

## Known AG bugs (context for future attempts)

### Server path bug (v1.16.5+)
AG constructs incorrect paths for its remote server binary. It looks for `.antigravity-server/bin/{commitHash}/node` but installs to `.antigravity-server/bin/{version}-{commitHash}/node`. Workaround is a symlink loop — see the thread below.

Source: https://discuss.ai.google.dev/t/can-no-longer-connect-to-devcontainer-after-updating-to-v1-16-5/121479

### General dev container instability
Multiple reports of dev container connections failing across AG versions.

Source: https://discuss.ai.google.dev/t/the-devcontainer-fails-to-attach-after-the-1-16-5-update-on-ubuntu-the-new-1-18-3-update-also-fails/124169

## Ideal solution (test periodically after AG updates)

The ideal approach is the same one Cursor uses — the `attached-container` URI scheme. This would attach directly to the existing devbox container with zero overhead or extra containers.

**To test if Antigravity has added support:**

1. Make sure you have a running devbox container:
   ```bash
   cd ~/your-project && devbox
   ```

2. Get the hex-encoded attach config:
   ```bash
   printf '{"containerName":"/dev-your-project-abcd"}' | xxd -p | tr -d '\n'
   ```

3. Try opening Antigravity with the URI:
   ```bash
   open -na "Antigravity" --args --folder-uri "vscode-remote://attached-container+<hex>/home/dev/workspace"
   ```

4. If it connects successfully (you see the container's filesystem at `/home/dev/workspace`, not your host home folder), then AG now supports `attached-container`. Update `openInAntigravity()` in `extensions/raycast/src/index.tsx` to use the same `openInCursor()` approach.

## References

- AG Dev Containers discussion: https://discuss.ai.google.dev/t/feature-request-native-devcontainer-support-in-antigravity/110492
- AG connection bug: https://discuss.ai.google.dev/t/the-devcontainer-fails-to-attach-after-the-1-16-5-update-on-ubuntu-the-new-1-18-3-update-also-fails/124169
- AG path bug: https://discuss.ai.google.dev/t/can-no-longer-connect-to-devcontainer-after-updating-to-v1-16-5/121479
