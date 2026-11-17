#!/usr/bin/env node
// Télécharge les deux jeux de données ouverts officiels et produit data/villes.json.
// Aucune dépendance. En cas d'erreur ou de résultat suspect, le script s'arrête
// sans écrire le fichier : on garde alors les données précédentes.
// Exception : les repères communaux (geo.api.gouv.fr) sont facultatifs. Si l'API
// ne répond pas, on reprend ceux de la version précédente et on continue.
'use strict';
const fs = require('fs');
const path = require('path');

const SOURCES = {
  crous: {
    titre: 'Ensemble des logements proposés aux étudiants par le réseau des Crous',
    editeur: "Cnous, via data.enseignementsup-recherche.gouv.fr (Licence Ouverte 2.0)",
    page: 'https://data.enseignementsup-recherche.gouv.fr/explore/dataset/fr_crous_logement_france_entiere/',
    url: 'https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/fr_crous_logement_france_entiere/exports/json',
  },
  loyers: {
    titre: '« Carte des loyers » : indicateurs de loyers d\'annonce par commune en 2025, appartements de 1 ou 2 pièces',
    editeur: 'Ministère chargé du logement, via data.gouv.fr',
    mention: 'Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin',
    page: 'https://www.data.gouv.fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025',
    url: 'https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/20251211-144934/pred-app12-mef-dhup.csv',
    millesime: '3e trimestre 2025',
    surface_reference: 37,
  },
  geo: {
    titre: 'API Découpage administratif : code Insee, département, région et population des communes',
    editeur: 'geo.api.gouv.fr (Etalab, données Insee)',
    page: 'https://www.data.gouv.fr/dataservices/api-decoupage-administratif-api-geo',
    url: 'https://geo.api.gouv.fr/communes',
  },
};
const GEO_FIELDS = 'code,nom,codeDepartement,departement,region,population,codesPostaux';

const MIN_RESIDENCES = 3; // une ville n'a sa page que si au moins 3 résidences affichent leurs tarifs
const MAX_VILLES = 30;

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\bst\b/g, 'saint').replace(/\bste\b/g, 'sainte').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/ /g, '-');
const clean = (s) => (s || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();

// curl plutôt que fetch : il respecte les variables de proxy de l'environnement.
function get(url, binary) {
  const { execFileSync } = require('child_process');
  const buf = execFileSync('curl', ['-sSfL', '--compressed', '--max-time', '120', '-A', 'budget-campus-data/1.0', url], { maxBuffer: 256 * 1024 * 1024 });
  return binary ? buf : buf.toString('utf8');
}

function communeFromAddress(addr) {
  const a = clean(addr).replace(/\s+/g, ' ');
  // code postal (éventuellement "92 260") suivi du nom de commune
  const m = a.match(/\b(\d{2}) ?(\d{3})\s+([A-Za-zÀ-ÿ'’\- ]+?)(?:\s+cedex.*)?$/i);
  if (!m) return null;
  return { cp: m[1] + m[2], nom: clean(m[3]) };
}

// Lignes de la fiche officielle qui mentionnent un tarif, recopiées telles quelles.
function tarifLines(infos) {
  const out = [];
  const parts = [];
  for (const raw of (infos || '').split(/\r?\n/)) {
    const l = clean(raw);
    if (l.length <= 160) parts.push(l);
    else {
      // phrases collées sur une seule ligne : on coupe après chaque montant, puis par phrase
      for (const piece of l.split(/(?<=€)\.\s*/)) {
        if (piece.length <= 220) parts.push(clean(piece));
        else parts.push(...piece.split(/(?<=[.;])\s*(?=[A-ZÀ-Ý])/).map(clean));
      }
    }
  }
  for (const l of parts) {
    if (!l || l.length > 220) continue;
    if (!/\d\s?(€|euros?)/i.test(l)) continue;
    if (/garantie|caution|parking|garage|frais|laverie|lave|s[èe]che|assurance|r[ée]servation|wifi\s*:|arrhes|provision|nuit|semaine|draps|kit\b|repas|quinzaine|s[ée]jour|passag/i.test(l)) continue;
    if (!amounts([l]).length) continue;
    out.push(l);
  }
  return out.slice(0, 8);
}

function amounts(lines) {
  const vals = [];
  for (const l of lines) {
    for (const m of l.matchAll(/(\d{3})(?:[.,](\d{1,2}))?\s?(?:€|euros?)/gi)) {
      const v = parseFloat(m[1] + '.' + (m[2] || '0'));
      if (v >= 120 && v <= 900) vals.push(v);
    }
  }
  return vals;
}

function dateTarif(infos) {
  const t = clean((infos || '').replace(/\s+/g, ' '));
  let m = t.match(/(?:loyers?|tarifs?)[^.]{0,60}?(20\d{2}\s?[/-]\s?20?\d{2})/i);
  if (m) return m[1].replace(/\s/g, '');
  m = t.match(/(?:au|compter du)\s+(\d{1,2}(?:er)?[/ ]\s?(?:\d{2}|[a-zéû]+)[/ ]\s?\d{2,4})/i);
  return m ? m[1] : null;
}

// Parmi les communes renvoyées par l'API pour un code postal, garde celle dont le
// nom correspond à l'adresse Crous et au département. Sinon, rien : pas de devinette.
function pickCommune(list, nom, dep) {
  if (!Array.isArray(list)) return null;
  const n = norm(nom);
  return list.find((c) => c && norm(c.nom || '') === n && c.codeDepartement === dep) || null;
}

// Repères communaux affichés sur la page ville, après contrôle de vraisemblance.
function communeInfo(c, dep) {
  if (!c || !/^(\d{5}|2[AB]\d{3})$/.test(c.code || '')) return null;
  if (c.codeDepartement !== dep) return null;
  if (!c.departement || !c.departement.nom || !c.region || !c.region.nom) return null;
  if (!Number.isInteger(c.population) || c.population < 5000 || c.population > 3000000) return null;
  return {
    insee: c.code,
    nom: c.nom,
    departement: { code: c.departement.code || dep, nom: c.departement.nom },
    region: c.region.nom,
    population: c.population,
    codes_postaux: Array.isArray(c.codesPostaux) ? c.codesPostaux.length : null,
  };
}

// Cherche la commune officielle d'un groupe d'adresses Crous. Renvoie null si
// aucun code postal ne donne de correspondance sûre. Une erreur réseau remonte.
function lookupCommune(cps, nom, dep, fetchJson) {
  for (const cp of cps) {
    const list = fetchJson(`${SOURCES.geo.url}?codePostal=${encodeURIComponent(cp)}&fields=${GEO_FIELDS}&format=json`);
    const hit = pickCommune(list, nom, dep);
    if (hit) return hit;
  }
  return null;
}

function parseCsv(buf) {
  const txt = new TextDecoder('latin1').decode(buf);
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(';').map((h) => h.replace(/"/g, ''));
  const num = (s) => parseFloat(String(s).replace(',', '.'));
  return lines.slice(1).map((l) => {
    const c = l.split(';').map((x) => x.replace(/^"|"$/g, ''));
    const o = Object.fromEntries(head.map((h, i) => [h, c[i]]));
    return {
      insee: o.INSEE_C, nom: o.LIBGEO, dep: o.DEP,
      m2: num(o.loypredm2), bas: num(o['lwr.IPm2']), haut: num(o['upr.IPm2']),
      type: o.TYPPRED, nbobs: parseInt(o.nbobs_com, 10), r2: num(o.R2_adj),
    };
  });
}

async function main() {
  const [crousTxt, loyersBuf] = await Promise.all([get(SOURCES.crous.url), get(SOURCES.loyers.url, true)]);
  const crous = JSON.parse(crousTxt);
  const loyers = parseCsv(loyersBuf);
  if (crous.length < 500) throw new Error('Jeu Crous anormalement court : ' + crous.length);
  if (loyers.length < 30000) throw new Error('Carte des loyers anormalement courte : ' + loyers.length);

  // Index des loyers par nom de commune + département, et arrondissements.
  const byKey = new Map();
  const byInsee = new Map();
  const arr = new Map(); // "marseille" -> lignes d'arrondissement
  for (const r of loyers) {
    if (r.insee) byInsee.set(r.insee, r);
    const mArr = r.nom.match(/^(Paris|Lyon|Marseille) (\d+)er? Arrondissement$/i) || r.nom.match(/^(Paris|Lyon|Marseille) (\d+)e Arrondissement$/i);
    if (mArr) {
      const k = norm(mArr[1]);
      if (!arr.has(k)) arr.set(k, []);
      arr.get(k).push({ ...r, arrondissement: parseInt(mArr[2], 10) });
      continue;
    }
    byKey.set(norm(r.nom) + '|' + r.dep, r);
  }

  const groups = new Map();
  for (const x of crous) {
    const c = communeFromAddress(x.address);
    if (!c) continue;
    let dep = c.cp.slice(0, 2);
    if (dep === '20') dep = c.cp < '20200' ? '2A' : '2B';
    if (dep === '97') continue; // outre-mer : codes différents, non traités pour l'instant
    const key = norm(c.nom) + '|' + dep;
    const lines = tarifLines(x.infos);
    const vals = amounts(lines);
    if (!groups.has(key)) groups.set(key, { nom: c.nom, dep, residences: [], total: 0, cps: new Map() });
    const g = groups.get(key);
    g.total++;
    g.cps.set(c.cp, (g.cps.get(c.cp) || 0) + 1);
    if (!vals.length) continue;
    g.residences.push({
      nom: clean(x.title),
      adresse: clean(x.address),
      description: clean(x.short_desc) || null,
      tarifs: lines,
      min: Math.min(...vals),
      max: Math.max(...vals),
      date_tarif: dateTarif(x.infos),
      lat: x.geocalisation ? x.geocalisation.lat : null,
      lon: x.geocalisation ? x.geocalisation.lon : null,
    });
  }

  // Repères communaux : facultatifs. Au premier échec réseau, on arrête de demander.
  let geoOk = true;
  const fetchJson = (url) => JSON.parse(get(url));

  const villes = [];
  for (const [key, g] of groups) {
    if (g.residences.length < MIN_RESIDENCES) continue;
    const n = key.split('|')[0];
    let commune = null;
    if (geoOk) {
      // codes postaux du plus fréquent au plus rare (les codes cedex ne donnent rien)
      const cps = [...g.cps.entries()].sort((a, b) => b[1] - a[1]).map(([cp]) => cp);
      try {
        commune = lookupCommune(cps, g.nom, g.dep, fetchJson);
      } catch (e) {
        geoOk = false;
        console.warn('geo.api.gouv.fr injoignable (' + e.message.split('\n')[0] + ') : repères communaux repris de la version précédente.');
      }
    }
    let prive;
    if (arr.has(n)) {
      const rows = arr.get(n).sort((a, b) => a.arrondissement - b.arrondissement);
      prive = { type: 'arrondissements', lignes: rows.map((r) => ({ nom: r.nom, m2: r.m2, bas: r.bas, haut: r.haut, nbobs: r.nbobs, r2: r.r2 })) };
    } else {
      // Jointure par code Insee quand on l'a, sinon par nom + département comme avant.
      const r = (commune && byInsee.get(commune.code)) || byKey.get(key);
      if (!r) continue;
      prive = { type: 'commune', lignes: [{ nom: r.nom, m2: r.m2, bas: r.bas, haut: r.haut, nbobs: r.nbobs, r2: r.r2, maille: r.type !== 'commune' }] };
    }
    for (const l of prive.lignes) {
      if (!(l.m2 > 4 && l.m2 < 60)) throw new Error('Loyer au m² invraisemblable pour ' + l.nom + ' : ' + l.m2);
    }
    const nomOfficiel = prive.type === 'commune' ? prive.lignes[0].nom : g.nom.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/^(paris|lyon|marseille)$/i, (m) => m[0].toUpperCase() + m.slice(1).toLowerCase());
    g.residences.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const v = { slug: slug(nomOfficiel), nom: nomOfficiel, dep: g.dep, nb_residences_total: g.total, residences: g.residences, prive };
    const info = communeInfo(commune, g.dep);
    if (info) v.commune = info;
    else if (commune) console.warn('Repères communaux écartés (invraisemblables) pour ' + nomOfficiel);
    villes.push(v);
  }

  // API injoignable : on garde les repères de la version précédente, ville par ville.
  if (!geoOk) {
    let prev = [];
    try { prev = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'villes.json'), 'utf8')).villes || []; } catch (e) { prev = []; }
    const old = new Map(prev.filter((p) => p.commune).map((p) => [p.slug, p.commune]));
    for (const v of villes) if (!v.commune && old.has(v.slug)) v.commune = old.get(v.slug);
  }
  villes.sort((a, b) => b.residences.length - a.residences.length || a.nom.localeCompare(b.nom, 'fr'));
  const top = villes.slice(0, MAX_VILLES).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  if (top.length < 10) throw new Error('Trop peu de villes exploitables : ' + top.length);

  const out = { genere_le: new Date().toISOString().slice(0, 10), sources: SOURCES, villes: top };
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'villes.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(`${top.length} villes, ${top.reduce((s, v) => s + v.residences.length, 0)} résidences avec tarifs.`);
  for (const v of top) console.log(' -', v.nom, v.dep, v.residences.length + '/' + v.nb_residences_total, v.prive.lignes.length > 1 ? '(arr.)' : v.prive.lignes[0].m2.toFixed(1) + ' €/m²', v.commune ? `| Insee ${v.commune.insee}, ${v.commune.population} hab., ${v.commune.departement.nom}, ${v.commune.region}` : '| sans repères communaux');
  console.log(`Repères communaux : ${top.filter((v) => v.commune).length}/${top.length} villes${geoOk ? '' : ' (API injoignable, valeurs précédentes)'}.`);
}

if (require.main === module) {
  main().catch((e) => { console.error('ÉCHEC update-data :', e.message); process.exit(1); });
}
module.exports = { norm, communeFromAddress, pickCommune, communeInfo, lookupCommune };
