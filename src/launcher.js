"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const proc = require("./proc");

function cliBinPath() {
  return path.join(path.resolve(__dirname, ".."), "bin", "fanavaran.js");
}

function userBinDir() {
  return path.join(os.homedir(), "bin");
}

function launcherUnix(cliBin) {
  return `#!/usr/bin/env bash
set -euo pipefail
CLI=${JSON.stringify(cliBin)}
if [ ! -f "$CLI" ]; then
  echo "Fanavaran CLI file is missing:" >&2
  echo "  $CLI" >&2
  echo "The folder was probably moved. From the Fanavaran-CLI repo run:" >&2
  echo "  node bin/fanavaran.js setup" >&2
  exit 1
fi
exec node "$CLI" "$@"
`;
}

function launcherWin(cliBin) {
  const escaped = cliBin.replace(/"/g, "");
  return `@echo off\r
if not exist "${escaped}" (\r
  echo Fanavaran CLI file is missing:\r
  echo   ${escaped}\r
  echo The folder was probably moved. From the Fanavaran-CLI repo run:\r
  echo   node bin/fanavaran.js setup\r
  exit /b 1\r
)\r
node "${escaped}" %*\r
`;
}

function replaceFile(dest, contents) {
  try {
    const st = fs.lstatSync(dest);
    if (st.isSymbolicLink() || st.isFile()) fs.unlinkSync(dest);
  } catch {
    /* nothing to replace */
  }
  fs.writeFileSync(dest, contents);
}

function installUserLauncher() {
  const cliBin = cliBinPath();
  if (!fs.existsSync(cliBin)) {
    throw new Error(`CLI entry is missing: ${cliBin}`);
  }
  const binDir = userBinDir();
  fs.mkdirSync(binDir, { recursive: true });

  const dest = proc.isWin
    ? path.join(binDir, "fanavaran.cmd")
    : path.join(binDir, "fanavaran");
  replaceFile(dest, proc.isWin ? launcherWin(cliBin) : launcherUnix(cliBin));
  if (!proc.isWin) fs.chmodSync(dest, 0o755);

  const smoke = spawnSync(process.execPath, [cliBin, "help"], {
    encoding: "utf8",
    timeout: 8000,
  });
  if (smoke.status !== 0) {
    throw new Error(`launcher wrote, but CLI did not run (${cliBin})`);
  }

  return { dest, cliBin, binDir };
}

function inspectUserLauncher() {
  const guessed = proc.which("fanavaran") || proc.which("fanavaran.cmd");
  const dest = guessed || (proc.isWin
    ? path.join(userBinDir(), "fanavaran.cmd")
    : path.join(userBinDir(), "fanavaran"));
  if (!dest || !fs.existsSync(dest)) {
    return { ok: false, dest, detail: "command not on PATH — run: node bin/fanavaran.js setup" };
  }
  let text = "";
  try {
    text = fs.readFileSync(dest, "utf8");
  } catch {
    return { ok: false, dest, detail: `cannot read ${dest}` };
  }
  const match =
    text.match(/CLI="([^"]+)"/) ||
    text.match(/node "([^"]*fanavaran\.js)"/) ||
    text.match(/node "([^"]+)"/);
  if (match && match[1] && !fs.existsSync(match[1])) {
    return {
      ok: false,
      dest,
      detail: `points at missing file:\n           ${match[1]}\n           Re-run:  node bin/fanavaran.js setup`,
    };
  }
  return { ok: true, dest, detail: dest };
}

module.exports = {
  cliBinPath,
  userBinDir,
  installUserLauncher,
  inspectUserLauncher,
};
