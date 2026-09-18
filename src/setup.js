"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ui = require("./ui");
const cfgLib = require("./config");
const proc = require("./proc");
const { installUserLauncher } = require("./launcher");

function ensureDirOnPathUnix(binDir) {
  const os = require("os");
  const rcFiles = [".zshrc", ".bashrc", ".zprofile", ".bash_profile"]
    .map((f) => path.join(os.homedir(), f))
    .filter((f) => fs.existsSync(f));
  const exportLine = `export PATH="${binDir}:$PATH"`;
  for (const rc of rcFiles) {
    const text = fs.readFileSync(rc, "utf8");
    if (text.includes(binDir) || text.includes("$HOME/bin")) return true;
  }
  const target = rcFiles.find((f) => f.endsWith(".zshrc")) || rcFiles[0] || path.join(os.homedir(), ".zshrc");
  fs.appendFileSync(
    target,
    `\n# Fanavaran CLI\n${exportLine}\n`
  );
  return true;
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

  try {
    const installed = installUserLauncher();
    if (proc.isWin) {
      const pathOk = ensureDirOnPathWin(installed.binDir);
      ui.ok(`launcher  ${installed.dest}`);
      ui.ok(`CLI       ${installed.cliBin}`);
      if (pathOk) ui.ok(`added ${installed.binDir} to your user PATH`);
      else ui.warn(`add this folder to PATH: ${installed.binDir}`);
    } else {
      ensureDirOnPathUnix(installed.binDir);
      ui.ok(`launcher  ${installed.dest}`);
      ui.ok(`CLI       ${installed.cliBin}`);
    }
    ui.dim("Open a new terminal, then run: fanavaran");
  } catch (err) {
    ui.fail(err.message || String(err));
    process.exit(1);
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
