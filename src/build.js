"use strict";

const { spawnSync } = require("child_process");
const ui = require("./ui");
const proc = require("./proc");

function runEas(cfg, args) {
  const eas = proc.which("eas");
  const cmd = eas ? "eas" : proc.npxCmd();
  const cmdArgs = eas ? args : ["--yes", "eas-cli", ...args];
  return spawnSync(cmd, cmdArgs, {
    cwd: cfg.dirs.app,
    encoding: "utf8",
    shell: proc.isWin,
    env: process.env,
  });
}

function runEasInherit(cfg, args) {
  const eas = proc.which("eas");
  const cmd = eas ? "eas" : proc.npxCmd();
  const cmdArgs = eas ? args : ["--yes", "eas-cli", ...args];
  return spawnSync(cmd, cmdArgs, {
    cwd: cfg.dirs.app,
    stdio: "inherit",
    shell: proc.isWin,
    env: process.env,
  });
}

function parseArtifact(jsonText) {
  try {
    let data = JSON.parse(jsonText);
    if (data && !Array.isArray(data)) {
      data = data.builds || data.data || [data];
    }
    if (!Array.isArray(data) || !data[0]) return null;
    const b = data[0];
    const arts = b.artifacts || {};
    return {
      platform: b.platform || "",
      status: b.status || "",
      id: b.id || "",
      download: arts.buildUrl || arts.applicationArchiveUrl || b.applicationArchiveUrl || "",
      page:
        b.buildDetailsPageUrl ||
        (b.id ? `https://expo.dev/accounts/${b.project?.owner || ""}/projects/${b.project?.slug || ""}/builds/${b.id}` : ""),
    };
  } catch {
    return null;
  }
}

function showLinks(cfg, platform) {
  const plats = platform === "both" ? ["android", "ios"] : [platform];
  ui.blank();
  ui.banner("EAS download links");
  const copied = [];
  for (const plat of plats) {
    const listed = runEas(cfg, [
      "build:list",
      "--platform",
      plat,
      "--limit",
      "1",
      "--json",
      "--non-interactive",
      "--status",
      "finished",
      "-e",
      cfg.easProfile,
    ]);
    let info = parseArtifact(listed.stdout || "");
    if (!info || !info.download) {
      const fallback = runEas(cfg, [
        "build:list",
        "--platform",
        plat,
        "--limit",
        "1",
        "--json",
        "--non-interactive",
      ]);
      info = parseArtifact(fallback.stdout || "");
    }
    if (!info) {
      ui.fail(`${plat}: no finished build found`);
      continue;
    }
    if (!info.page && info.id) {
      info.page = `https://expo.dev/accounts/${cfg.easAccount}/projects/${cfg.easSlug}/builds/${info.id}`;
    }
    ui.heading(`${plat}  ${ui.c.dim("(" + info.status + ")")}`);
    if (info.download) {
      console.log(`  ${ui.c.green("download")}  ${info.download}`);
      copied.push(info.download);
      proc.openUrl(info.download);
    } else {
      ui.warn("download not ready yet — use the Expo page");
    }
    if (info.page) ui.dim(`expo page ${info.page}`);
    ui.blank();
  }
  if (copied.length && proc.copyToClipboard(copied.join("\n"))) {
    ui.dim("download link copied to clipboard");
    ui.blank();
  }
}

async function build(cfg, platform) {
  const easPlat = platform === "both" ? "all" : platform;
  ui.heading(`Starting Fanavaran EAS build (${platform} / profile ${cfg.easProfile})…`);
  ui.dim("This is an Expo cloud build. It can take several minutes.");
  ui.blank();

  const who = runEas(cfg, ["whoami"]);
  if (who.status !== 0) {
    ui.fail("not logged in to Expo");
    ui.dim(`cd "${cfg.dirs.app}" && npx eas-cli login`);
    process.exit(1);
  }
  ui.ok(`Expo account: ${String(who.stdout || "").trim().split(/\n/).pop()}`);

  const result = runEasInherit(cfg, [
    "build",
    "--platform",
    easPlat,
    "--profile",
    cfg.easProfile,
    "--non-interactive",
    "--wait",
  ]);
  showLinks(cfg, platform);
  if (result.status) {
    ui.fail(`EAS build failed (exit ${result.status})`);
    process.exit(result.status);
  }
  ui.ok("EAS build finished");
}

module.exports = { build };
