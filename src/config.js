"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const CONFIG_DIR = path.join(os.homedir(), ".fanavaran");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

const REPO_KEYS = {
  api: "Fanavaran-API",
  app: "Fanavaran-Application",
  student: "Fanavaran-Student",
  dashboard: "Fanavaran-Dashboard",
};

const DEFAULTS = {
  ports: {
    api: 3201,
    student: 8585,
    dashboard: 7676,
    app: 8081,
  },
  avd: "flutter_emulator",
  iosSimulator: "iPhone 16 Pro",
  easProfile: "preview",
  easAccount: "fanavaran",
  easSlug: "fanavaran-app",
  studentLogin: {
    email: "The.Sam.Nolan1998@gmail.com",
    password: "Test1234!",
  },
};

function cliRoot() {
  return path.resolve(__dirname, "..");
}

function workspaceFromCli() {
  return path.resolve(cliRoot(), "..");
}

function looksLikeWorkspace(root) {
  if (!root || !fs.existsSync(root)) return false;
  return fs.existsSync(path.join(root, REPO_KEYS.api)) &&
    fs.existsSync(path.join(root, REPO_KEYS.app));
}

function findWorkspaceFromCwd(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  for (let i = 0; i < 8; i++) {
    if (looksLikeWorkspace(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readRawConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(partial) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const next = { ...readRawConfig(), ...partial, updatedAt: new Date().toISOString() };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n");
  return next;
}

function detectRoot() {
  if (process.env.FANAVARAN_ROOT && looksLikeWorkspace(process.env.FANAVARAN_ROOT)) {
    return path.resolve(process.env.FANAVARAN_ROOT);
  }
  const saved = readRawConfig().root;
  if (saved && looksLikeWorkspace(saved)) return saved;
  const fromCli = workspaceFromCli();
  if (looksLikeWorkspace(fromCli)) return fromCli;
  const fromCwd = findWorkspaceFromCwd(process.cwd());
  if (fromCwd) return fromCwd;
  return saved || fromCli;
}

function load() {
  const raw = readRawConfig();
  const root = detectRoot();
  const repos = { ...REPO_KEYS, ...(raw.repos || {}) };
  const ports = { ...DEFAULTS.ports, ...(raw.ports || {}) };
  const dirs = {};
  for (const [key, folder] of Object.entries(repos)) {
    dirs[key] = path.isAbsolute(folder) ? folder : path.join(root, folder);
  }
  if (!raw.root && looksLikeWorkspace(root)) {
    try {
      writeConfig({ root });
    } catch {
      /* first-run save is optional */
    }
  }
  return {
    root,
    configPath: CONFIG_PATH,
    repos,
    dirs,
    ports,
    avd: raw.avd || DEFAULTS.avd,
    iosSimulator: raw.iosSimulator || DEFAULTS.iosSimulator,
    easProfile: raw.easProfile || DEFAULTS.easProfile,
    easAccount: raw.easAccount || DEFAULTS.easAccount,
    easSlug: raw.easSlug || DEFAULTS.easSlug,
    studentLogin: { ...DEFAULTS.studentLogin, ...(raw.studentLogin || {}) },
    runDir: path.join(root, ".run"),
    logDir: path.join(root, ".run", "logs"),
    pidDir: path.join(root, ".run", "pids"),
    valid: looksLikeWorkspace(root),
  };
}

function ensureRunDirs(cfg) {
  fs.mkdirSync(cfg.logDir, { recursive: true });
  fs.mkdirSync(cfg.pidDir, { recursive: true });
}

function urls(cfg) {
  return {
    api: `http://localhost:${cfg.ports.api}`,
    apiHealth: `http://localhost:${cfg.ports.api}/health`,
    student: `http://localhost:${cfg.ports.student}`,
    dashboard: `http://localhost:${cfg.ports.dashboard}`,
    app: `http://localhost:${cfg.ports.app}`,
  };
}

module.exports = {
  CONFIG_PATH,
  REPO_KEYS,
  DEFAULTS,
  cliRoot,
  looksLikeWorkspace,
  readRawConfig,
  writeConfig,
  detectRoot,
  load,
  ensureRunDirs,
  urls,
};
