#!/usr/bin/env node

import readline from 'readline';
import os from 'os';
import { readConfig, writeConfig, clearConfig, getToken } from '../src/config.js';
import { API_BASE_URL, SESSION_EXPIRY_DAYS } from '../src/constants.js';

const args = process.argv.slice(2);
const isRefresh = args.includes('--refresh');
const isLogout = args.includes('--logout');

async function login() {
  // If already logged in, show current session info and exit
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

  const email = await ask('Email: ');
  const totpCode = await ask('Authenticator code (TOTP): ');
  const defaultDevice = os.hostname();
  const deviceInput = await ask(`Device name [${defaultDevice}]: `);
  const deviceName = deviceInput.trim() || defaultDevice;
  rl.close();

  const res = await fetch(`${API_BASE_URL}/api/mcp/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      totpCode: totpCode.trim(),
      deviceName,
    }),
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
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      console.error('Session expired or invalid. Run planora to re-authenticate.');
      process.exit(1);
    }
    throw new Error(data.error ?? 'Refresh failed');
  }

  const config = readConfig();
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
    // Best-effort server-side revocation — clear locally regardless of outcome
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

try {
  if (isLogout) {
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
