# Launchly local agent

Runs on your computer. It's the only thing that gives Monitor's AI real access
to a project: read/write files, run commands. Without it running, Monitor
will tell you "Computer disconnected" and refuse to pretend otherwise.

## Setup (once)

```
cd local-agent
npm install
```

## Connect a computer

1. Open Monitor on the site, click the **"Connect computer"** pill next to
   "Full access" in the message box.
2. Click **Connect this computer** — this issues a one-time token and shows
   the exact command to run, including the server address.
3. Run that command from this folder, pointed at your real project folder:

```
node agent.js --root "C:\Users\you\Launchly" --token <token from step 2> --server <wss://... from step 2>
```

Leave it running. The pill in Monitor turns green ("online") once it
connects. Closing the terminal disconnects it — Monitor will show
"Computer disconnected" again, honestly, not a fake state.

## What it can do

Only inside `--root`, nothing else:
- Read a file
- Write/create a file
- List a directory
- Run a shell command (npm, git, your dev server, etc.)
- Screen control (Windows only, via PowerShell — no extra packages needed):
  screenshot, mouse move/click/double-click/right-click, type, keypress,
  hotkey, scroll, wait

Any path a tool call gives that would resolve outside `--root` is refused.
Screen input runs one action at a time; destructive combinations
(Ctrl+Alt+Del) are blocked in the agent, and destructive commands pause
for your approval in Monitor unless you enabled automatic editing.

## Security

- The token is shown once, at pairing time, and is required to connect.
- One agent process serves one project root at a time — pair again (get a
  new token) to switch projects, or point a second agent at a second folder
  if you need more than one connected at once (each pairing is a separate
  device row on the backend).
