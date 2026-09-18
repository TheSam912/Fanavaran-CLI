"use strict";

const fs = require("fs");
const path = require("path");
const ui = require("./ui");
const { urls, ensureRunDirs } = require("./config");
const proc = require("./proc");

const LABELS = {
  api: "API",
  student: "Student web",
  dashboard: "Dashboard",
  app: "Mobile Expo",
};

function logFile(cfg, name) {
  return path.join(cfg.logDir, `${name}.log`);
}

function startApi(cfg) {
  if (proc.pidOnPort(cfg.ports.api)) {
    ui.ok(`API already on :${cfg.ports.api}`);
    return;
  }
  proc.ensureNodeModules(cfg.dirs.api);
  ui.info("starting API");
  const pid = proc.startDetached(proc.npmCmd(), ["run", "dev"], {
    cwd: cfg.dirs.api,
    logFile: logFile(cfg, "api"),
    env: {
      TZ: "America/Toronto",
      NODE_ENV: "development",
      HOST: "0.0.0.0",
      PORT: String(cfg.ports.api),
    },
  });
  proc.writePid(cfg, "api", pid);
}

function startStudent(cfg) {
  if (proc.pidOnPort(cfg.ports.student)) {
    ui.ok(`Student already on :${cfg.ports.student}`);
    return;
  }
  proc.ensureNodeModules(cfg.dirs.student, ["--legacy-peer-deps"]);
  ui.info("starting Student web");
  const pid = proc.startDetached(proc.npmCmd(), ["run", "dev"], {
    cwd: cfg.dirs.student,
    logFile: logFile(cfg, "student"),
    env: { TZ: "America/Toronto" },
  });
  proc.writePid(cfg, "student", pid);
}

function startDashboard(cfg) {
  if (proc.pidOnPort(cfg.ports.dashboard)) {
    ui.ok(`Dashboard already on :${cfg.ports.dashboard}`);
    return;
  }
  proc.ensureNodeModules(cfg.dirs.dashboard, ["--legacy-peer-deps"]);
  ui.info("starting Dashboard");
  const pid = proc.startDetached(proc.npmCmd(), ["run", "dev"], {
    cwd: cfg.dirs.dashboard,
    logFile: logFile(cfg, "dashboard"),
    env: { TZ: "America/Toronto" },
  });
  proc.writePid(cfg, "dashboard", pid);
}

function startExpo(cfg) {
  if (proc.pidOnPort(cfg.ports.app)) {
    ui.ok(`Expo already on :${cfg.ports.app}`);
    return;
  }
  proc.ensureNodeModules(cfg.dirs.app);
  ui.info("starting Expo");
  const pid = proc.startDetached(
    proc.npxCmd(),
    ["expo", "start", "-c", "--offline", "--port", String(cfg.ports.app)],
    {
      cwd: cfg.dirs.app,
      logFile: logFile(cfg, "app"),
      env: proc.androidEnv(),
    }
  );
  proc.writePid(cfg, "app", pid);
}

function stopNamed(cfg, name) {
  const pid = proc.readPid(cfg, name);
  if (pid) proc.killPid(pid);
  proc.clearPid(cfg, name);
  if (cfg.ports[name]) proc.stopPort(cfg.ports[name]);
}

function stopServices(cfg, names) {
  ui.heading("Stopping Fanavaran…");
  for (const name of names) stopNamed(cfg, name);
  ui.ok("stopped");
}

function printStatus(cfg) {
  const link = urls(cfg);
  ui.banner(`${path.basename(cfg.root)}  ·  ${proc.isWin ? "Windows" : proc.isMac ? "macOS" : process.platform}`);
  ui.table([
    ["Service", "URL", "Status"],
    ["API", link.api, proc.pidOnPort(cfg.ports.api) ? ui.c.green("up") : ui.c.red("down")],
    ["Student", link.student, proc.pidOnPort(cfg.ports.student) ? ui.c.green("up") : ui.c.red("down")],
    ["Dashboard", link.dashboard, proc.pidOnPort(cfg.ports.dashboard) ? ui.c.green("up") : ui.c.red("down")],
    ["Expo", link.app, proc.pidOnPort(cfg.ports.app) ? ui.c.green("up") : ui.c.red("down")],
  ]);
  ui.blank();
  ui.dim(`Health     ${link.apiHealth}`);
  ui.dim(`LAN IP     ${proc.lanIp()}`);
  ui.dim(`Root       ${cfg.root}`);
  ui.blank();
  ui.heading("Student login");
  console.log(`    email     ${cfg.studentLogin.email}`);
  console.log(`    password  ${cfg.studentLogin.password}`);
  ui.blank();
}

function followLogs(cfg, names, opts = {}) {
  const files = names.map((name) => ({
    name,
    file: logFile(cfg, name),
    pos: 0,
  }));
  for (const item of files) {
    if (!fs.existsSync(item.file)) fs.writeFileSync(item.file, "");
    const stat = fs.statSync(item.file);
    item.pos = Math.max(0, stat.size - 4000);
  }
  const colors = {
    api: ui.c.blue,
    student: ui.c.magenta,
    dashboard: ui.c.cyan,
    app: ui.c.yellow,
  };
  if (!opts.quiet) {
    ui.heading("Live logs");
    ui.dim("Ctrl+C stops the log view — services keep running");
    ui.dim("────────────────────────────────────────────────");
  }
  const timer = setInterval(() => {
    for (const item of files) {
      if (!fs.existsSync(item.file)) continue;
      const stat = fs.statSync(item.file);
      if (stat.size <= item.pos) continue;
      const fd = fs.openSync(item.file, "r");
      const len = stat.size - item.pos;
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, item.pos);
      fs.closeSync(fd);
      item.pos = stat.size;
      const tag = (colors[item.name] || ui.c.white)(`[${LABELS[item.name] || item.name}]`.padEnd(14));
      for (const line of buf.toString("utf8").split(/\r?\n/)) {
        if (!line) continue;
        console.log(`${tag} ${ui.paint("log", line)}`);
      }
    }
  }, 250);
  return () => clearInterval(timer);
}

module.exports = {
  LABELS,
  logFile,
  startApi,
  startStudent,
  startDashboard,
  startExpo,
  stopNamed,
  stopServices,
  printStatus,
  followLogs,
  ensureRunDirs,
};
