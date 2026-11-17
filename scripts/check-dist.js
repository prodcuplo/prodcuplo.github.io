#!/usr/bin/env node
// Contrôle du site généré avant publication. Un seul problème = échec = pas de déploiement.
'use strict';
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const errors = [];
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else files.push(p); } })(DIST);
const htmls = files.filter((f) => f.endsWith('.html'));
const exists = (url) => {
  const u = url.split('#')[0].split('?')[0];
  const p = path.join(DIST, u);
  return fs.existsSync(u.endsWith('/') ? path.join(p, 'index.html') : p);
};
const titles = new Map(), descs = new Map();
const external = new Set();
for (const f of htmls) {
  const rel = '/' + path.relative(DIST, f);
  const s = fs.readFileSync(f, 'utf8');
  const t = (s.match(/<title>([^<]*)<\/title>/) || [])[1];
  const d = (s.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (!t || t.length < 15) errors.push(`${rel} : titre absent ou trop court`);
  if (!d || d.length < 50) errors.push(`${rel} : description absente ou trop courte`);
  if (d && d.length > 200) errors.push(`${rel} : description trop longue (${d.length})`);
  if (titles.has(t)) errors.push(`${rel} : titre en double avec ${titles.get(t)}`); else titles.set(t, rel);
  if (descs.has(d)) errors.push(`${rel} : description en double avec ${descs.get(d)}`); else descs.set(d, rel);
  if ((s.match(/<h1[ >]/g) || []).length !== 1) errors.push(`${rel} : il faut exactement un h1`);
  if (!/<link rel="canonical" href="https:\/\//.test(s)) errors.push(`${rel} : canonical absent`);
  const text = s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  for (const bad of ['undefined', 'NaN', '[object Object]', 'null €', 'Infinity']) if (text.includes(bad)) errors.push(`${rel} : contient « ${bad} »`);
  if (text.replace(/\s+/g, ' ').length < 600) errors.push(`${rel} : page trop pauvre en contenu`);
  for (const m of s.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const u = m[1].replace(/&amp;/g, '&');
    if (u.startsWith('/')) { if (!exists(u)) errors.push(`${rel} : lien interne cassé ${u}`); }
    else if (/^https?:\/\//.test(u)) external.add(u);
    else if (!u.startsWith('#') && !u.startsWith('mailto:')) errors.push(`${rel} : lien relatif inattendu ${u}`);
  }
  for (const m of s.matchAll(/<script type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); } catch (e) { errors.push(`${rel} : JSON invalide`); } }
  if (/data-tool=/.test(s) && !/id="result"/.test(s)) errors.push(`${rel} : outil sans zone de résultat`);
}
for (const need of ['sitemap.xml', 'robots.txt', '404.html', 'index.html', 'assets/calc.js', 'assets/ui.js', 'assets/style.css']) if (!fs.existsSync(path.join(DIST, need))) errors.push(`fichier manquant : ${need}`);
if (htmls.length < 30) errors.push(`seulement ${htmls.length} pages : anormal`);
fs.writeFileSync(path.join(DIST, 'liens-externes.json'), JSON.stringify([...external].sort(), null, 1) + '\n');
if (errors.length) { console.error(`ÉCHEC : ${errors.length} problème(s)`); errors.slice(0, 60).forEach((e) => console.error(' - ' + e)); process.exit(1); }
console.log(`OK : ${htmls.length} pages, ${external.size} liens externes distincts, aucun problème.`);
