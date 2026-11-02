#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'linux') {
  console.error('[file-forge] This installer is for Linux only.');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launcher = path.join(root, 'open-file-forge.sh');

if (!existsSync(launcher)) {
  console.error(`[file-forge] Launcher not found: ${launcher}`);
  process.exit(1);
}

function quote(value) {
  return `"${value.replace(/([\\`"$])/g, '\\$1')}"`;
}

const entry = `[Desktop Entry]
Type=Application
Name=File Forge
Comment=Launch the File Forge web app
Exec=/bin/bash ${quote(launcher)}
Path=${root}
Terminal=true
Icon=applications-development
Categories=Utility;
StartupNotify=true
`;

async function installEntry(directory, filename) {
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, filename);
  await fs.writeFile(file, entry);
  await fs.chmod(file, 0o755);
  spawnSync('gio', ['set', file, 'metadata::trusted', 'true'], {
    stdio: 'ignore',
  });
  return file;
}

const applicationsDir = path.join(
  os.homedir(),
  '.local',
  'share',
  'applications',
);
const applicationEntry = await installEntry(applicationsDir, 'file-forge.desktop');
console.log(`[file-forge] Installed application menu entry: ${applicationEntry}`);

const desktopDir = path.join(os.homedir(), 'Desktop');
const desktopStat = await fs.stat(desktopDir).catch(() => undefined);

if (desktopStat?.isDirectory()) {
  const desktopEntry = await installEntry(desktopDir, 'File Forge.desktop');
  console.log(`[file-forge] Installed desktop shortcut: ${desktopEntry}`);
  console.log('[file-forge] If it is marked untrusted, right-click it and choose Allow Launching.');
}
