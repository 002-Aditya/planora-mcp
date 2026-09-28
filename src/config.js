import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.planora');
const CONFIG_FILE = path.join(CONFIG_DIR, 'mcp.env');

function parseEnvFile(content) {
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    result[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return result;
}

export function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  return parseEnvFile(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

export function writeConfig({ token, deviceName, expiresAt }) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  const content = [
    `PLANORA_SESSION_TOKEN=${token}`,
    `PLANORA_DEVICE_NAME=${deviceName}`,
    `PLANORA_TOKEN_EXPIRES_AT=${expiresAt}`,
  ].join('\n') + '\n';
  // 0o600 = owner read/write only — token file is private
  fs.writeFileSync(CONFIG_FILE, content, { mode: 0o600 });
}

export function clearConfig() {
  if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
}

export function getToken() {
  return readConfig()?.PLANORA_SESSION_TOKEN ?? null;
}

export function getTokenExpiresAt() {
  return readConfig()?.PLANORA_TOKEN_EXPIRES_AT ?? null;
}
