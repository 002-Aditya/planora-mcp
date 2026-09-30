#!/usr/bin/env node

import readline from 'readline';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { readConfig, writeConfig, clearConfig, getToken } from '../src/config.js';
import { API_BASE_URL, SESSION_EXPIRY_DAYS } from '../src/constants.js';

const args = process.argv.slice(2);
const isRefresh = args.includes('--refresh');
const isLogout  = args.includes('--logout');
const isConnect = args[0] === 'connect';

// ── Auth ──────────────────────────────────────────────────────────────────────

async function login() {
  const config = readConfig();
  if (config?.PLANORA_SESSION_TOKEN) {
    const expiresAt = config.PLANORA_TOKEN_EXPIRES_AT;
    const daysLeft = expiresAt
      ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
    const deviceName = config.PLANORA_DEVICE_NAME ?? 'Unknown Device';
    if (daysLeft !== null && daysLeft > 0) {
      console.log(`Already logged in as "${deviceName}" (expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}).`);
      console.log(`Run 'planora --refresh' to renew or 'planora --logout' to sign out.`);
      return;
    }
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

  console.log('Connecting to Planora...\n');

  const email      = await ask('Email: ');
  const totpCode   = await ask('Authenticator code (TOTP): ');
  const defaultDevice = os.hostname();
  const deviceInput   = await ask(`Device name [${defaultDevice}]: `);
  const deviceName    = deviceInput.trim() || defaultDevice;
  rl.close();

  const res = await fetch(`${API_BASE_URL}/api/mcp/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), totpCode: totpCode.trim(), deviceName }),
  });

  const data = await res.json();
  if (!res.ok) {
    if (data.code === 'ACCOUNT_NOT_FOUND') {
      console.error(`\nNo Planora account found for ${email.trim()}.`);
      console.error(`Sign up first at: ${data.signupUrl ?? 'https://planora-frontend.pages.dev'}`);
      process.exit(1);
    }
    throw new Error(data.error ?? 'Authentication failed');
  }

  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  writeConfig({ token: data.token, deviceName, expiresAt });

  console.log(`\nConnected as ${email.trim()} on "${deviceName}".`);
  console.log(`Token valid for ${SESSION_EXPIRY_DAYS} days. Run 'planora --refresh' before it expires.`);
}

async function refresh() {
  const token = getToken();
  if (!token) {
    console.error('No active session. Run planora to authenticate.');
    process.exit(1);
  }

  console.log('Refreshing session token...');

  const res = await fetch(`${API_BASE_URL}/api/mcp/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      console.error('Session expired or invalid. Run planora to re-authenticate.');
      process.exit(1);
    }
    throw new Error(data.error ?? 'Refresh failed');
  }

  const config    = readConfig();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  writeConfig({ token: data.token, deviceName: config.PLANORA_DEVICE_NAME, expiresAt });

  console.log(`Session refreshed. New token valid for ${SESSION_EXPIRY_DAYS} days.`);
}

async function logout() {
  const token = getToken();
  if (!token) {
    console.log('No active session found.');
    process.exit(0);
  }

  console.log('Logging out...');

  try {
    await fetch(`${API_BASE_URL}/api/mcp/auth/session/current`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  } catch {
    // Ignore network errors — local token is cleared either way
  }

  clearConfig();
  console.log('Logged out. Local session cleared.');
}

// ── Connect ───────────────────────────────────────────────────────────────────

function resolveMcpCommand() {
  try {
    const bin = execSync(
      process.platform === 'win32' ? 'where planora-mcp' : 'which planora-mcp',
      { stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim().split('\n')[0].trim();
    if (bin) return { command: bin, args: [] };
  } catch { /* not installed globally */ }
  return { command: 'npx', args: ['--prefer-offline', 'planora-mcp'] };
}

/**
 * Reads a JSON config file (returns {} if missing), merges the planora MCP entry
 * under config.mcpServers.planora, and writes it back.
 */
function upsertJsonConfig(filePath, buildConfig) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let existing = {};
  if (fs.existsSync(filePath)) {
    try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { /* corrupt file — start fresh */ }
  }

  const entry = resolveMcpCommand();
  const existing_entry = existing?.mcpServers?.planora ?? existing?.mcpServers?.['planora-mcp'];
  const alreadySet =
    existing_entry?.command === entry.command &&
    JSON.stringify(existing_entry?.args) === JSON.stringify(entry.args);

  if (alreadySet) {
    console.log('Planora is already connected to this client.');
    return;
  }

  const updated = buildConfig(existing, entry);
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + '\n');
  console.log(`Config updated: ${filePath}`);
}

function connectClaudeCLI() {
  console.log('Connecting Planora to Claude Code...');
  const entry = resolveMcpCommand();
  const cmdArgs = [entry.command, ...entry.args].join(' ');
  try {
    execSync(`claude mcp add planora-mcp --scope user -- ${cmdArgs}`, { stdio: 'inherit' });
    console.log('\nDone. Restart Claude Code or run /mcp to reload.');
  } catch {
    console.error('\nFailed. Make sure the Claude Code CLI is installed: https://claude.ai/code');
    process.exit(1);
  }
}

function connectClaudeDesktop() {
  console.log('Connecting Planora to Claude Desktop...');
  const configPath =
    process.platform === 'win32'
      ? path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json')
      : path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');

  upsertJsonConfig(configPath, (existing, entry) => ({
    ...existing,
    mcpServers: { ...(existing.mcpServers ?? {}), planora: entry },
  }));
  console.log('Restart Claude Desktop to apply.');
}

function connectCursor() {
  console.log('Connecting Planora to Cursor...');
  const configPath = path.join(os.homedir(), '.cursor', 'mcp.json');
  upsertJsonConfig(configPath, (existing, entry) => ({
    ...existing,
    mcpServers: { ...(existing.mcpServers ?? {}), planora: entry },
  }));
  console.log('Restart Cursor to apply.');
}

function connectWindsurf() {
  console.log('Connecting Planora to Windsurf...');
  const configPath = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
  upsertJsonConfig(configPath, (existing, entry) => ({
    ...existing,
    mcpServers: { ...(existing.mcpServers ?? {}), planora: entry },
  }));
  console.log('Restart Windsurf to apply.');
}

function connectGemini() {
  console.log('Connecting Planora to Gemini CLI...');
  const configPath = path.join(os.homedir(), '.gemini', 'settings.json');
  upsertJsonConfig(configPath, (existing, entry) => ({
    ...existing,
    mcpServers: { ...(existing.mcpServers ?? {}), planora: entry },
  }));
  console.log('Restart Gemini CLI to apply.');
}

const CONNECT_CLIENTS = {
  claude:         connectClaudeCLI,
  'claude-desktop': connectClaudeDesktop,
  cursor:         connectCursor,
  windsurf:       connectWindsurf,
  gemini:         connectGemini,
};

function connect(client) {
  if (!client || !CONNECT_CLIENTS[client]) {
    console.log('Usage: planora connect <client>\n');
    console.log('Supported clients:');
    console.log('  claude           Claude Code (CLI)');
    console.log('  claude-desktop   Claude Desktop');
    console.log('  cursor           Cursor');
    console.log('  windsurf         Windsurf');
    console.log('  gemini           Gemini CLI');
    process.exit(client ? 1 : 0);
  }
  CONNECT_CLIENTS[client]();
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

try {
  if (isConnect) {
    connect(args[1]);
  } else if (isLogout) {
    await logout();
  } else if (isRefresh) {
    await refresh();
  } else {
    await login();
  }
  process.exit(0);
} catch (err) {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
}
