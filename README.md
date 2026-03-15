# devbox

Personal Docker setup for containerizing dev projects. Each project gets its own isolated persistent container where Claude Code runs without restrictions. Comes with a Raycast extension to quickly open projects in Cursor, Antigravity, or Claude Code.

## Install

```bash
git clone https://github.com/charlier/devbox.git
cd devbox
./install.sh
```

## Usage

```bash
cd ~/my-project && devbox        # Start container for this project
devbox list                      # List all project containers
devbox stop                      # Stop current project's container
devbox rm dev-old-project-a3f1   # Remove a container
devbox -p web                    # Start with dev server ports exposed
```

## Raycast Extension

```bash
cd extensions/raycast && npm install && npm run build
```

The extension lists projects that already have a devbox container — run `devbox` in a project directory first to create one. From there, open in Cursor (`Cmd+Shift+C`), Antigravity (`Cmd+Shift+A`), or Claude Code in Ghostty (`Cmd+Shift+T`). Default editor configurable in Raycast preferences.

## Uninstall

Remove the Raycast extension:

```bash
rm -rf ~/Library/Application\ Support/Raycast/Extensions/devbox
```

Stop and remove all devbox containers and volumes:

```bash
docker ps -a --filter 'name=^dev-' -q | xargs docker rm -f
docker volume ls -q | grep -E '^dev-|^devbox-' | xargs docker volume rm
docker rmi devbox:latest
```

Remove devbox itself:

```bash
rm ~/.local/bin/devbox
rm -rf ~/.local/share/devbox
rm -rf ~/.config/devbox
```
