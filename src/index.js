"use strict";

const path = require("path");
const ui = require("./ui");
const cfgLib = require("./config");
const proc = require("./proc");
const stack = require("./stack");
const session = require("./session");
const { help } = require("./help");
const { setup } = require("./setup");
const { doctor } = require("./doctor");
const { build } = require("./build");

function parseFlags(args) {
  return {
    noBrowser: args.includes("--no-browser"),
    noLogs: args.includes("--no-logs"),
    rest: args.filter((a) => a !== "--no-browser" && a !== "--no-logs"),
  };
}

function takePlatform(args) {
  const hit = args.find((a) => ["android", "ios", "both"].includes(a));
  return hit || null;
}

async function askPlatform() {
  return ui.select("android or iOS?", [
    { value: "android", label: "android", aliases: ["a"] },
    { value: "ios", label: "iOS", aliases: ["i", "ios"] },
    { value: "both", label: "both", aliases: ["b"] },
  ]);
}

async function resolvePlatform(args) {
  const taken = takePlatform(args);
  if (taken) {
    if (taken !== "android" && proc.isWin) {
      ui.warn("iOS Simulator is not available on Windows — using android");
      return "android";
    }
    return taken;
  }
  const picked = await askPlatform();
  if (picked !== "android" && proc.isWin) {
    ui.warn("iOS Simulator is not available on Windows — using android");
    return "android";
  }
  return picked;
}

async function askStartTarget() {
  return ui.select("What do you want to run?", [
    { value: "app", label: "app", hint: "API + Expo + emulator", aliases: ["a"] },
    { value: "web", label: "student web", hint: "API + Student site", aliases: ["student", "s"] },
    { value: "dashboard", label: "dashboard", hint: "API + Admin LMS", aliases: ["d", "admin"] },
    { value: "api", label: "api", aliases: [] },
    { value: "all", label: "all web", hint: "API + Student + Dashboard", aliases: [] },
  ]);
}

function needWorkspace(cfg) {
  if (cfg.valid) return;
  ui.fail("Fanavaran workspace not found.");
  ui.dim(`Looked at: ${cfg.root}`);
  ui.dim("Run  fanavaran setup  and paste the folder that contains the four repos.");
  process.exit(1);
}

function printConfig(cfg) {
  ui.banner("config");
  ui.table([
    ["Key", "Value"],
    ["root", cfg.root],
    ["api", cfg.dirs.api],
    ["app", cfg.dirs.app],
    ["student", cfg.dirs.student],
    ["dashboard", cfg.dirs.dashboard],
    ["avd", cfg.avd],
    ["ios sim", cfg.iosSimulator],
    ["eas", cfg.easProfile],
    ["config file", cfg.configPath],
  ]);
  ui.blank();
  ui.dim("Set root:  fanavaran config set root /path/to/fanavaran");
  ui.dim("Env var:   FANAVARAN_ROOT=/path/to/fanavaran");
  ui.blank();
}

function printRepos(cfg) {
  ui.banner("repos");
  ui.table([
    ["Repo", "Branch", "Dirty", "Path"],
    ...Object.entries(cfg.dirs).map(([key, dir]) => {
      const git = proc.gitShort(dir);
      return [key, git.branch, git.dirty ? String(git.dirty) : "clean", dir];
    }),
  ]);
  ui.blank();
}

async function dispatchStart(cfg, target, args, flags) {
  stack.ensureRunDirs(cfg);
  switch (target) {
    case "app":
      await session.startAppFlow(cfg, await resolvePlatform(args), flags);
      return;
    case "web":
    case "student":
      await session.startStudentFlow(cfg, flags);
      return;
    case "dashboard":
    case "admin":
      await session.startDashboardFlow(cfg, flags);
      return;
    case "api":
      await session.startApiFlow(cfg, flags);
      return;
    case "all":
      await session.startAllWebFlow(cfg, flags);
      return;
    default:
      ui.fail(`Unknown start target: ${target}`);
      help();
      process.exit(1);
  }
}

function stopFromArgs(cfg, args) {
  stack.ensureRunDirs(cfg);
  const names = args[0];
  if (!names || names === "all") {
    stack.stopServices(cfg, ["api", "student", "dashboard", "app"]);
    return;
  }
  if (names === "web") {
    stack.stopServices(cfg, ["student"]);
    return;
  }
  if (["api", "app", "student", "dashboard"].includes(names)) {
    stack.stopServices(cfg, [names]);
    return;
  }
  ui.fail(`Unknown stop target: ${names}`);
  process.exit(1);
}

function openFromArgs(cfg, args) {
  const { urls } = cfgLib;
  const links = urls(cfg);
  const target = args[0] || "student";
  const map = {
    student: links.student,
    web: links.student,
    dashboard: links.dashboard,
    admin: links.dashboard,
    api: links.api,
    app: links.app,
  };
  const url = map[target];
  if (!url) {
    ui.fail("open student | dashboard | api");
    process.exit(1);
  }
  proc.openUrl(url);
  ui.ok(url);
}

async function main(argv) {
  const flags = parseFlags(argv);
  const args = flags.rest;
  const cmd = args[0] || "";
  const rest = args.slice(1);

  if (["help", "-h", "--help"].includes(cmd)) {
    help();
    return;
  }
  if (cmd === "setup" || cmd === "init" || cmd === "install") {
    await setup();
    return;
  }

  const cfg = cfgLib.load();

  switch (cmd) {
    case "":
    case "start": {
      needWorkspace(cfg);
      const target = rest[0] && !["android", "ios", "both"].includes(rest[0])
        ? rest[0]
        : await askStartTarget();
      await dispatchStart(cfg, target, rest, flags);
      return;
    }
    case "app":
    case "android":
    case "ios":
    case "both": {
      needWorkspace(cfg);
      const platformArgs = cmd === "app" ? rest : [cmd, ...rest];
      await dispatchStart(cfg, "app", platformArgs, flags);
      return;
    }
    case "web":
    case "student":
    case "dashboard":
    case "admin":
    case "api":
    case "all":
      needWorkspace(cfg);
      await dispatchStart(cfg, cmd, rest, flags);
      return;
    case "stop":
      needWorkspace(cfg);
      stopFromArgs(cfg, rest);
      stack.printStatus(cfg);
      return;
    case "restart": {
      needWorkspace(cfg);
      stopFromArgs(cfg, ["all"]);
      const target = await askStartTarget();
      await dispatchStart(cfg, target, rest, flags);
      return;
    }
    case "status":
      needWorkspace(cfg);
      stack.printStatus(cfg);
      return;
    case "logs": {
      needWorkspace(cfg);
      stack.ensureRunDirs(cfg);
      const names = rest[0] ? [rest[0]] : ["api", "student", "dashboard", "app"];
      const stop = stack.followLogs(cfg, names);
      await new Promise((resolve) => process.once("SIGINT", resolve));
      stop();
      return;
    }
    case "open":
      needWorkspace(cfg);
      openFromArgs(cfg, rest);
      return;
    case "build":
      needWorkspace(cfg);
      await build(cfg, await resolvePlatform(rest));
      return;
    case "doctor":
      await doctor(cfg);
      return;
    case "config": {
      if (rest[0] === "set" && rest[1] === "root" && rest[2]) {
        const root = path.resolve(rest[2]);
        if (!cfgLib.looksLikeWorkspace(root)) {
          ui.fail(`Not a Fanavaran workspace: ${root}`);
          process.exit(1);
        }
        cfgLib.writeConfig({ root });
        ui.ok(`root saved  ${root}`);
        return;
      }
      if (rest[0] === "set" && rest[1] && rest[2]) {
        const key = rest[1];
        const allowed = ["avd", "iosSimulator", "easProfile"];
        if (!allowed.includes(key)) {
          ui.fail(`Can set: root | ${allowed.join(" | ")}`);
          process.exit(1);
        }
        cfgLib.writeConfig({ [key]: rest.slice(2).join(" ") });
        ui.ok(`${key} = ${rest.slice(2).join(" ")}`);
        return;
      }
      printConfig(cfg);
      return;
    }
    case "repos":
      needWorkspace(cfg);
      printRepos(cfg);
      return;
    default:
      ui.fail(`Unknown command: ${cmd}`);
      help();
      process.exit(1);
  }
}

module.exports = { main };
