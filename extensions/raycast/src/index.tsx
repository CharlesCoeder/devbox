import {
  ActionPanel,
  Action,
  List,
  showToast,
  Toast,
  Icon,
  Color,
  confirmAlert,
  Alert,
  getPreferenceValues,
} from "@raycast/api";
import { useState, useEffect, useCallback } from "react";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ── Types ────────────────────────────────────────────────────────────

interface DevboxContainer {
  name: string;
  status: string;
  running: boolean;
  projectPath: string;
  hex: string;
}

type EditorId = "cursor" | "antigravity" | "claude";

interface Editor {
  id: EditorId;
  name: string;
  icon: Icon;
  shortcut: { modifiers: ("cmd" | "shift" | "opt" | "ctrl")[]; key: string };
}

interface Preferences {
  defaultEditor: EditorId;
}

// ── Editors ──────────────────────────────────────────────────────────

const EDITORS: Editor[] = [
  {
    id: "cursor",
    name: "Cursor",
    icon: Icon.Code,
    shortcut: { modifiers: ["cmd", "shift"], key: "c" },
  },
  {
    id: "antigravity",
    name: "Antigravity",
    icon: Icon.Globe,
    shortcut: { modifiers: ["cmd", "shift"], key: "a" },
  },
  {
    id: "claude",
    name: "Claude Code",
    icon: Icon.Terminal,
    shortcut: { modifiers: ["cmd", "shift"], key: "t" },
  },
];

// ── Docker helpers ───────────────────────────────────────────────────

const DOCKER_PATH = "/usr/local/bin/docker";
const STATE_DIR = join(homedir(), ".local/share/devbox/projects");

function exec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 10000 }).trim();
  } catch {
    return "";
  }
}

function getAttachHex(containerName: string): string {
  const config = JSON.stringify({ containerName: `/${containerName}` });
  return Buffer.from(config).toString("hex");
}

function getProjectPath(containerName: string): string {
  const metaFile = join(STATE_DIR, containerName, "path");
  if (existsSync(metaFile)) {
    return readFileSync(metaFile, "utf-8").trim();
  }
  return "";
}

function listContainers(): DevboxContainer[] {
  const raw = exec(
    `${DOCKER_PATH} ps -a --filter "name=^dev-" --format "{{.Names}}\\t{{.Status}}" 2>/dev/null`
  );
  if (!raw) return [];

  return raw.split("\n").map((line) => {
    const [name, status] = line.split("\t");
    return {
      name,
      status,
      running: status.startsWith("Up"),
      projectPath: getProjectPath(name),
      hex: getAttachHex(name),
    };
  });
}

function startContainer(name: string): boolean {
  try {
    execSync(`${DOCKER_PATH} start ${name}`, { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

function stopContainer(name: string): boolean {
  try {
    execSync(`${DOCKER_PATH} stop ${name}`, { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

function removeContainer(name: string): boolean {
  try {
    execSync(`${DOCKER_PATH} rm -f ${name}`, { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

// ── Editor openers ──────────────────────────────────────────────────

function ensureRunning(c: DevboxContainer): DevboxContainer | null {
  if (c.running) return c;

  showToast({ style: Toast.Style.Animated, title: "Starting container..." });
  if (!startContainer(c.name)) {
    showToast({ style: Toast.Style.Failure, title: "Failed to start container" });
    return null;
  }
  // Hex is based on container name (stable), no need to re-fetch
  return { ...c, running: true };
}

function openInCursor(hex: string, remotePath: string) {
  const uri = `vscode-remote://attached-container+${hex}${remotePath}`;
  try {
    execSync(`/usr/bin/open -na "Cursor" --args --folder-uri "${uri}"`);
  } catch (e) {
    showToast({
      style: Toast.Style.Failure,
      title: "Failed to open Cursor",
      message: String(e),
    });
  }
}

function openInAntigravity(container: DevboxContainer) {
  // AG doesn't support attached-container URI or programmatic devcontainer opening.
  // Open the project folder directly — files are the same (bind mount from host).
  // See docs/antigravity-devcontainer.md for context and future fix instructions.
  const projectPath = container.projectPath;
  if (!projectPath) {
    showToast({
      style: Toast.Style.Failure,
      title: "No project path",
      message: "Cannot determine project directory for this container",
    });
    return;
  }

  const agCli = "/Applications/Antigravity.app/Contents/Resources/app/bin/antigravity";
  try {
    execSync(`"${agCli}" --new-window "${projectPath}"`, { timeout: 10000 });
  } catch {
    try {
      execSync(`/usr/bin/open -na "Antigravity" "${projectPath}"`);
    } catch (e) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to open Antigravity",
        message: String(e),
      });
    }
  }
}

function openInClaudeCode(containerName: string) {
  const cmd = `${DOCKER_PATH} exec -it ${containerName} bash -lc 'source ~/.nvm/nvm.sh && claude --dangerously-skip-permissions'`;

  // Check if Ghostty is already running
  const ghosttyRunning = exec(`/usr/bin/pgrep -x ghostty`) !== "";

  if (ghosttyRunning) {
    // Open a new tab in the existing Ghostty window via AppleScript
    try {
      execSync(`/usr/bin/osascript <<'SCRIPT'
tell application "Ghostty" to activate
delay 0.2
tell application "System Events" to tell process "Ghostty"
  click menu item "New Tab" of menu "Shell" of menu bar 1
  delay 0.3
  keystroke "${cmd}"
  delay 0.1
  key code 36
end tell
SCRIPT`);
      return;
    } catch {
      // Fall through to launch script approach
    }
  }

  // Launch new Ghostty window with a script
  const scriptPath = join(homedir(), ".local/share/devbox", "claude-launch.sh");
  const scriptContent = `#!/bin/bash\nexec ${cmd}\n`;

  try {
    writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
    execSync(`/usr/bin/open -na "Ghostty" --args -e "${scriptPath}"`);
  } catch {
    // Fallback: Terminal.app
    try {
      execSync(`/usr/bin/osascript -e 'tell application "Terminal"
        activate
        do script "${cmd}"
      end tell'`);
    } catch (e) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to open Claude Code",
        message: String(e),
      });
    }
  }
}

function openInEditor(editor: EditorId, container: DevboxContainer) {
  const active = ensureRunning(container);
  if (!active) return;

  switch (editor) {
    case "cursor":
      openInCursor(active.hex, "/home/dev/workspace");
      break;
    case "antigravity":
      openInAntigravity(active);
      break;
    case "claude":
      openInClaudeCode(active.name);
      break;
  }

  showToast({
    style: Toast.Style.Success,
    title: `Opening in ${EDITORS.find((e) => e.id === editor)?.name}`,
  });
}

// ── Main Command ─────────────────────────────────────────────────────

export default function Command() {
  const { defaultEditor } = getPreferenceValues<Preferences>();
  const [containers, setContainers] = useState<DevboxContainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setContainers(listContainers());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!isLoading && containers.length === 0) {
    return (
      <List>
        <List.EmptyView
          title="No devbox containers"
          description="cd into a project and run `devbox` to create one"
          icon={Icon.Box}
        />
      </List>
    );
  }

  // Put default editor first, then the rest
  const defaultEditorInfo = EDITORS.find((e) => e.id === defaultEditor) ?? EDITORS[0];
  const otherEditors = EDITORS.filter((e) => e.id !== defaultEditorInfo.id);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter projects...">
      {containers.map((c) => (
        <List.Item
          key={c.name}
          title={c.name.replace(/^dev-/, "").replace(/-[a-f0-9]{4}$/, "")}
          subtitle={c.projectPath}
          icon={{
            source: c.running ? Icon.CircleFilled : Icon.Circle,
            tintColor: c.running ? Color.Green : Color.SecondaryText,
          }}
          accessories={[
            {
              text: c.running ? "Running" : "Stopped",
              icon: c.running
                ? { source: Icon.Bolt, tintColor: Color.Green }
                : { source: Icon.Moon, tintColor: Color.SecondaryText },
            },
          ]}
          actions={
            <ActionPanel>
              <ActionPanel.Section title="Open">
                {/* Default editor is the primary action (Enter) */}
                <Action
                  title={`Open in ${defaultEditorInfo.name}`}
                  icon={defaultEditorInfo.icon}
                  onAction={() => openInEditor(defaultEditorInfo.id, c)}
                />
                {/* Other editors with keyboard shortcuts */}
                {otherEditors.map((editor) => (
                  <Action
                    key={editor.id}
                    title={`Open in ${editor.name}`}
                    icon={editor.icon}
                    shortcut={editor.shortcut}
                    onAction={() => openInEditor(editor.id, c)}
                  />
                ))}
                {c.projectPath && (
                  <Action.OpenWith
                    title="Open Project Folder in Finder"
                    path={c.projectPath}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
                  />
                )}
              </ActionPanel.Section>

              <ActionPanel.Section title="Container">
                {c.running ? (
                  <Action
                    title="Stop Container"
                    icon={{ source: Icon.Stop, tintColor: Color.Red }}
                    shortcut={{ modifiers: ["cmd"], key: "s" }}
                    onAction={async () => {
                      showToast({ style: Toast.Style.Animated, title: "Stopping..." });
                      if (stopContainer(c.name)) {
                        showToast({ style: Toast.Style.Success, title: "Stopped" });
                        refresh();
                      } else {
                        showToast({ style: Toast.Style.Failure, title: "Failed to stop" });
                      }
                    }}
                  />
                ) : (
                  <Action
                    title="Start Container"
                    icon={{ source: Icon.Play, tintColor: Color.Green }}
                    shortcut={{ modifiers: ["cmd"], key: "s" }}
                    onAction={async () => {
                      showToast({ style: Toast.Style.Animated, title: "Starting..." });
                      if (startContainer(c.name)) {
                        showToast({ style: Toast.Style.Success, title: "Started" });
                        refresh();
                      } else {
                        showToast({ style: Toast.Style.Failure, title: "Failed to start" });
                      }
                    }}
                  />
                )}
                <Action
                  title="Remove Container"
                  icon={{ source: Icon.Trash, tintColor: Color.Red }}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
                  onAction={async () => {
                    if (
                      await confirmAlert({
                        title: "Remove Container?",
                        message: `This will remove ${c.name} and its volumes.`,
                        primaryAction: {
                          title: "Remove",
                          style: Alert.ActionStyle.Destructive,
                        },
                      })
                    ) {
                      removeContainer(c.name);
                      showToast({ style: Toast.Style.Success, title: "Removed" });
                      refresh();
                    }
                  }}
                />
              </ActionPanel.Section>

              <ActionPanel.Section>
                <Action
                  title="Refresh"
                  icon={Icon.ArrowClockwise}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                  onAction={refresh}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
