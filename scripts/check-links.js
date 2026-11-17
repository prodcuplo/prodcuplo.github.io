#!/usr/bin/env node
// Vérifie les liens externes listés par check-dist. Signale les liens morts (404, 410, DNS).
// Les refus anti-robot (403, 429) et les erreurs réseau passagères sont listés à part, sans échec.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const SITE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'site.json'), 'utf8')).url;
const urls = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dist', 'liens-externes.json'), 'utf8')).filter((u) => !u.startsWith(SITE));
const dead = [], unsure = [];
for (const u of urls) {
  let code = '000';
  try { code = execFileSync('curl', ['-sSL', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '30', '-A', 'Mozilla/5.0 (compatible; verification-liens)', u], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { code = (e.stdout || '').toString().trim() || '000'; }
  if (code === '404' || code === '410') dead.push(`${code} ${u}`);
  else if (!/^2|^3/.test(code)) unsure.push(`${code} ${u}`);
}
console.log(`${urls.length} liens vérifiés. Morts : ${dead.length}. Non vérifiables : ${unsure.length}.`);
unsure.forEach((x) => console.log(' ? ' + x));
if (dead.length) { dead.forEach((x) => console.error(' X ' + x)); process.exit(1); }
