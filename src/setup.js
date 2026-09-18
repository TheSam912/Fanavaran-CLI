"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const ui = require("./ui");
const cfgLib = require("./config");
const proc = require("./proc");

function launcherUnix(cliBin) {
  return `#!/usr/bin/env bash
exec node ${JSON.stringify(cliBin)} "$@"
`;
}

function launcherWin(cliBin) {
  return `@echo off\r\nnode ${JSON.stringify(cliBin)} %*\r\n`;
}

function ensureDirOnPathUnix(binDir) {
  const rcFiles = [".zshrc", ".bashrc", ".zprofile", ".bash_profile"]
    .map((f) => path.join(os.homedir(), f))
    .filter((f) => fs.existsSync(f));
  const exportLine = `export PATH="${binDir}:$PATH"`;
  let wrote = false;
  for (const rc of rcFiles) {
    const text = fs.readFileSync(rc, "utf8");
    if (text.includes(binDir) || text.includes("$HOME/bin")) return true;
  }
  const target = rcFiles.find((f) => f.endsWith(".zshrc")) || rcFiles[0] || path.join(os.homedir(), ".zshrc");
  fs.appendFileSync(
    target,
    `\n# Fanavaran CLI\n${exportLine}\n`
  );
  wrote = true;
  return wrote;
}

function ensureDirOnPathWin(binDir) {
  try {
    const out = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `[Environment]::GetEnvironmentVariable('Path','User')`,
      ],
      { encoding: "utf8" }
    );
    const current = String(out.stdout || "").trim();
    if (current.toLowerCase().includes(binDir.toLowerCase())) return true;
    const next = current ? `${current};${binDir}` : binDir;
    spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `[Environment]::SetEnvironmentVariable('Path', ${JSON.stringify(next)}, 'User')`,
      ],
      { stdio: "ignore" }
    );
    return true;
  } catch {
    return false;
  }
}

async function setup() {
  ui.banner("setup");
  ui.heading("Where is the Fanavaran workspace?");
  ui.dim("The folder that contains Fanavaran-API, Fanavaran-Application,");
  ui.dim("Fanavaran-Student and Fanavaran-Dashboard.");
  ui.blank();

  const detected = cfgLib.detectRoot();
  const hint = cfgLib.looksLikeWorkspace(detected) ? detected : "";
  const typed = await ui.question(
    `  ${ui.c.dim("path:")} ${hint ? ui.c.dim("(" + hint + ") ") : ""}`
  );
  const root = path.resolve(typed || hint || "");
  if (!cfgLib.looksLikeWorkspace(root)) {
    ui.fail(`That folder does not look like the Fanavaran workspace:`);
    ui.dim(root);
    ui.dim("Expected siblings: Fanavaran-API and Fanavaran-Application");
    process.exit(1);
  }

  cfgLib.writeConfig({ root });
  const cfg = cfgLib.load();
  ui.ok(`workspace  ${cfg.root}`);
  for (const [key, dir] of Object.entries(cfg.dirs)) {
    if (fs.existsSync(dir)) ui.ok(`${key.padEnd(10)} ${dir}`);
    else ui.warn(`${key.padEnd(10)} missing  ${dir}`);
  }

  const cliBin = path.join(cfgLib.cliRoot(), "bin", "fanavaran.js");
  const userBin = path.join(os.homedir(), "bin");
  fs.mkdirSync(userBin, { recursive: true });

  if (proc.isWin) {
    const cmdPath = path.join(userBin, "fanavaran.cmd");
    fs.writeFileSync(cmdPath, launcherWin(cliBin));
    const pathOk = ensureDirOnPathWin(userBin);
    ui.ok(`launcher  ${cmdPath}`);
    if (pathOk) ui.ok(`added ${userBin} to your user PATH`);
    else ui.warn(`add this folder to PATH: ${userBin}`);
    ui.dim("Open a new terminal, then run: fanavaran");
  } else {
    const dest = path.join(userBin, "fanavaran");
    fs.writeFileSync(dest, launcherUnix(cliBin));
    fs.chmodSync(dest, 0o755);
    ensureDirOnPathUnix(userBin);
    ui.ok(`launcher  ${dest}`);
    ui.dim("Open a new terminal, then run: fanavaran");
  }

  ui.blank();
  if (await ui.confirm("Install npm dependencies in each repo now?", true)) {
    for (const [key, dir] of Object.entries(cfg.dirs)) {
      if (!fs.existsSync(path.join(dir, "package.json"))) continue;
      ui.heading(`npm install  ${key}`);
      const extra = key === "student" || key === "dashboard" ? ["--legacy-peer-deps"] : [];
      try {
        if (fs.existsSync(path.join(dir, "node_modules"))) {
          ui.ok("already installed");
          continue;
        }
        proc.ensureNodeModules(dir, extra);
        ui.ok("done");
      } catch (err) {
        ui.fail(String(err.message || err));
      }
    }
  }

  ui.blank();
  ui.ok("Setup complete. Try:  fanavaran doctor");
  ui.blank();
}

module.exports = { setup };
