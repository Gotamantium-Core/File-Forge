#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const url = `http://127.0.0.1:${port}`;
const isWindows = process.platform === 'win32';
const npmCommand = 'npm';
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const distIndex = path.join(root, 'dist', 'index.html');
const noOpen = process.argv.includes('--no-open');

let serverProcess;
let stopping = false;

function log(message) {
  console.log(`[file-forge] ${message}`);
}

function warn(message) {
  console.warn(`[file-forge] ${message}`);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = isWindows
      ? spawn(process.env.ComSpec ?? 'cmd.exe', [
          '/d',
          '/s',
          '/c',
          `${command} ${args.join(' ')}`,
        ], {
          cwd: root,
          stdio: 'inherit',
          env: process.env,
        })
      : spawn(command, args, {
          cwd: root,
          stdio: 'inherit',
          env: process.env,
        });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${path.basename(command)} exited with code ${code}.`));
    });
  });
}

async function statOrUndefined(file) {
  try {
    return await fs.stat(file);
  } catch {
    return undefined;
  }
}

async function newestMtime(target) {
  const stat = await statOrUndefined(target);
  if (!stat) return 0;
  if (!stat.isDirectory()) return stat.mtimeMs;

  const entries = await fs.readdir(target, { withFileTypes: true });
  let newest = stat.mtimeMs;

  for (const entry of entries) {
    newest = Math.max(newest, await newestMtime(path.join(target, entry.name)));
  }

  return newest;
}

async function healthOk() {
  try {
    const response = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(1200),
    });
    if (!response.ok) return false;
    const body = await response.json();
    return body?.name === 'file-forge';
  } catch {
    return false;
  }
}

async function portInUse() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };

    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}

async function ensureDependencies() {
  const lockStat = await statOrUndefined(path.join(root, 'package-lock.json'));
  const stampStat = await statOrUndefined(
    path.join(root, 'node_modules', '.package-lock.json'),
  );
  const missing =
    !existsSync(tsxCli) ||
    !existsSync(path.join(root, 'node_modules', 'express', 'package.json')) ||
    !existsSync(path.join(root, 'node_modules', 'react', 'package.json')) ||
    !existsSync(path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'));
  const outdated =
    lockStat !== undefined &&
    stampStat !== undefined &&
    lockStat.mtimeMs > stampStat.mtimeMs + 1000;

  if (missing || outdated) {
    log(missing ? 'Installing dependencies (first run)...' : 'Updating dependencies...');
    await run(npmCommand, ['install']);
  }
}

async function ensureBuild() {
  const distStat = await statOrUndefined(distIndex);
  let needsBuild = distStat === undefined;

  if (distStat) {
    const sources = [
      'src',
      'shared',
      'index.html',
      'vite.config.ts',
      'tsconfig.json',
      'package.json',
      'package-lock.json',
    ];
    let newest = 0;

    for (const source of sources) {
      newest = Math.max(newest, await newestMtime(path.join(root, source)));
    }

    needsBuild = newest > distStat.mtimeMs;
  }

  if (needsBuild) {
    log('Building the app...');
    await run(npmCommand, ['run', 'build']);
  }
}

function startServer() {
  log(`Starting File Forge at ${url}`);
  serverProcess = spawn(process.execPath, [tsxCli, 'server/index.ts'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) },
  });

  serverProcess.on('error', (error) => {
    console.error(`[file-forge] Could not start the server: ${error.message}`);
    process.exit(1);
  });

  serverProcess.on('exit', (code) => {
    if (!stopping && code !== null && code !== 0) {
      console.error(`[file-forge] Server exited with code ${code}.`);
    }
  });
}

async function waitForServer() {
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    if (serverProcess?.exitCode !== null) {
      throw new Error(
        `The server exited before it became ready (code ${serverProcess.exitCode}).`,
      );
    }
    if (await healthOk()) return;
    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

function openBrowser() {
  const platform = process.platform;
  let command;
  let args;

  if (platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', url];
  } else if (platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  const opener = spawn(command, args, { stdio: 'ignore', detached: true });
  opener.on('error', () => {
    warn('Could not open the browser automatically.');
    log(`Open ${url} manually.`);
  });
  opener.unref();
}

function launchBrowser() {
  if (noOpen) {
    log(`Open ${url} in your browser.`);
    return;
  }
  openBrowser();
}

async function reuseExisting() {
  log(`File Forge is already running at ${url}`);
  launchBrowser();
  await sleep(300);
  process.exit(0);
}

function shutdown(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;

  if (!serverProcess || serverProcess.exitCode !== null) {
    process.exit(0);
    return;
  }

  log('Stopping File Forge...');
  serverProcess.kill(signal);

  const force = setTimeout(() => {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill('SIGKILL');
    }
  }, 3000);
  force.unref();

  serverProcess.once('exit', () => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
  }
});

async function main() {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isFinite(major) || major < 20) {
    throw new Error(
      `Node.js 20 or newer is required (found ${process.versions.node}).`,
    );
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
  }

  if (await healthOk()) {
    await reuseExisting();
  }

  await ensureDependencies();
  await ensureBuild();

  if (await healthOk()) {
    await reuseExisting();
  }

  if (await portInUse()) {
    throw new Error(
      `Port ${port} is already in use. Close the other app or set PORT to a different value.`,
    );
  }

  startServer();
  await waitForServer();
  launchBrowser();
  log(`File Forge is running at ${url}`);
  log('Close this window or press Ctrl+C to stop.');
}

main().catch((error) => {
  console.error(
    `[file-forge] ${error instanceof Error ? error.message : String(error)}`,
  );
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
  }
  process.exit(1);
});
