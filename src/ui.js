"use strict";

const readline = require("readline");

const enabled =
  Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && process.env.TERM !== "dumb";

const wrap = (code) => (text) =>
  enabled ? `\x1b[${code}m${text}\x1b[0m` : String(text);

const c = {
  reset: wrap("0"),
  bold: wrap("1"),
  dim: wrap("2"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  blue: wrap("34"),
  magenta: wrap("35"),
  cyan: wrap("36"),
  white: wrap("37"),
};

function paint(kind, line) {
  const lower = String(line).toLowerCase();
  if (/error|exception|failed|eaddrinuse|econnreset|fatal/.test(lower)) {
    return c.red(c.bold(line));
  }
  if (/warn/.test(lower)) return c.yellow(line);
  return line;
}

function banner(subtitle) {
  const title = "FANAVARAN  ·  local CLI";
  const sub = subtitle || "API  ·  Student  ·  Dashboard  ·  App";
  const inner = 58;
  const pad = (s) => {
    const visible = String(s);
    const rest = Math.max(0, inner - visible.length);
    const left = Math.floor(rest / 2);
    const right = rest - left;
    return "│" + " ".repeat(left) + visible + " ".repeat(right) + "│";
  };
  console.log();
  console.log(c.cyan("╭" + "─".repeat(inner) + "╮"));
  console.log(c.cyan(pad("")));
  console.log(c.cyan("│") + c.bold(c.white(center(title, inner))) + c.cyan("│"));
  console.log(c.cyan("│") + c.dim(center(sub, inner)) + c.cyan("│"));
  console.log(c.cyan(pad("")));
  console.log(c.cyan("╰" + "─".repeat(inner) + "╯"));
  console.log();
}

function center(text, width) {
  const rest = width - text.length;
  const left = Math.max(0, Math.floor(rest / 2));
  const right = Math.max(0, rest - left);
  return " ".repeat(left) + text + " ".repeat(right);
}

function ok(msg) {
  console.log(`  ${c.green("✓")} ${msg}`);
}

function fail(msg) {
  console.log(`  ${c.red("✗")} ${msg}`);
}

function warn(msg) {
  console.log(`  ${c.yellow("!")} ${msg}`);
}

function info(msg) {
  console.log(`  ${c.dim("…")} ${msg}`);
}

function heading(msg) {
  console.log(`  ${c.bold(msg)}`);
}

function dim(msg) {
  console.log(`  ${c.dim(msg)}`);
}

function blank() {
  console.log();
}

function keyHint(key, text) {
  return `  ${c.cyan(key.padEnd(10))} ${text}`;
}

async function question(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await new Promise((resolve) => {
    rl.question(promptText, resolve);
  });
  rl.close();
  return String(answer || "").trim();
}

async function confirm(promptText, defaultYes) {
  const hint = defaultYes ? "Y/n" : "y/N";
  const raw = await question(`  ${promptText} ${c.dim("[" + hint + "]")} `);
  if (!raw) return Boolean(defaultYes);
  return /^(y|yes|1)$/i.test(raw);
}

async function select(title, options) {
  if (!process.stdin.isTTY) {
    throw new Error(`Specify one of: ${options.map((o) => o.value).join(", ")}`);
  }
  blank();
  heading(title);
  options.forEach((opt, i) => {
    const n = c.cyan(`${i + 1})`);
    const extra = opt.hint ? `  ${c.dim(opt.hint)}` : "";
    console.log(`    ${n} ${opt.label}${extra}`);
  });
  for (;;) {
    const raw = await question(`  ${c.dim("choose:")} `);
    const asNum = Number(raw);
    if (Number.isInteger(asNum) && asNum >= 1 && asNum <= options.length) {
      return options[asNum - 1].value;
    }
    const hit = options.find(
      (opt) =>
        String(opt.value).toLowerCase() === raw.toLowerCase() ||
        (opt.aliases || []).some((a) => String(a).toLowerCase() === raw.toLowerCase())
    );
    if (hit) return hit.value;
    warn(`Type 1–${options.length}, or ${options.map((o) => o.value).join(" / ")}.`);
  }
}

function table(rows) {
  const cols = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i] ?? "").length)));
  rows.forEach((row, idx) => {
    const line = row
      .map((cell, i) => String(cell ?? "").padEnd(cols[i]))
      .join("   ");
    console.log(`  ${idx === 0 ? c.bold(line) : line}`);
  });
}

module.exports = {
  c,
  paint,
  banner,
  ok,
  fail,
  warn,
  info,
  heading,
  dim,
  blank,
  keyHint,
  question,
  confirm,
  select,
  table,
};
