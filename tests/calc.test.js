'use strict';
// Tests des formules. Les valeurs attendues viennent des exemples chiffrés
// publiés par les sources officielles citées dans data/baremes.json.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/calc.js');
const B = require('../data/baremes.json');

test('stage : exemple officiel service-public (441 h = 1 984,50 €)', () => {
  const ex = B.gratification_stage.exemple_officiel;
  const r = C.gratificationStage(B.gratification_stage, ex.heures);
  assert.equal(r.obligatoire, true);
  assert.equal(r.total, ex.montant);
});

test('stage : pas de gratification obligatoire jusqu\'à 308 h, obligatoire à 309 h', () => {
  assert.equal(C.gratificationStage(B.gratification_stage, 308).obligatoire, false);
  assert.equal(C.gratificationStage(B.gratification_stage, 308).total, 0);
  const r = C.gratificationStage(B.gratification_stage, 309);
  assert.equal(r.obligatoire, true);
  assert.equal(r.total, 1390.5);
});

test('stage : un taux conventionnel inférieur au minimum légal est ignoré', () => {
  assert.equal(C.gratificationStage(B.gratification_stage, 400, 3).taux, 4.5);
  assert.equal(C.gratificationStage(B.gratification_stage, 400, 5).total, 2000);
  assert.throws(() => C.gratificationStage(B.gratification_stage, -1));
});

test('bourse : cohérence du barème (18 lignes, 8 échelons, plafonds ordonnés)', () => {
  const b = B.bourse;
  assert.equal(b.plafonds.length, 18);
  assert.equal(b.echelons.length, 8);
  assert.equal(b.montants_annuels.length, 8);
  b.plafonds.forEach((ligne, p) => {
    assert.equal(ligne.length, 8);
    for (let i = 1; i < 8; i++) assert.ok(ligne[i] < ligne[i - 1], `ligne ${p} non décroissante`);
    if (p > 0) for (let i = 0; i < 8; i++) assert.ok(ligne[i] > b.plafonds[p - 1][i], `colonne ${i} non croissante en ${p}`);
  });
  for (let i = 1; i < 8; i++) assert.ok(b.montants_annuels[i] > b.montants_annuels[i - 1]);
});

test('bourse : montants officiels 2026-2027', () => {
  assert.deepEqual(B.bourse.montants_annuels, [1454, 2163, 3071, 3828, 4587, 5212, 5506, 6335]);
});

test('bourse : échelon selon le revenu, bornes incluses', () => {
  const b = B.bourse;
  assert.equal(C.echelonBourse(b, 35086, 0).echelon, '0 bis');
  assert.equal(C.echelonBourse(b, 35087, 0).eligible, false);
  assert.equal(C.echelonBourse(b, 23850, 0).echelon, '1');
  assert.equal(C.echelonBourse(b, 23851, 0).echelon, '0 bis');
  assert.equal(C.echelonBourse(b, 265, 0).echelon, '7');
  assert.equal(C.echelonBourse(b, 0, 0).echelon, '7');
  assert.equal(C.echelonBourse(b, 0, 0).annuel, 6335);
  assert.equal(C.echelonBourse(b, 0, 0).mensuel, 633.5);
  assert.equal(C.echelonBourse(b, 20000, 2).echelon, '3');
  assert.equal(C.echelonBourse(b, 101347, 17).echelon, '0 bis');
  assert.equal(C.echelonBourse(b, 101347, 25).hors_bareme, true);
  assert.throws(() => C.echelonBourse(b, -5, 0));
  assert.throws(() => C.echelonBourse(b, 100, 1.5));
});

test('bourse : points de charge (circulaire du 13 février 2026)', () => {
  const b = B.bourse;
  assert.equal(C.pointsDistance(b, 0), 0);
  assert.equal(C.pointsDistance(b, 29), 0);
  assert.equal(C.pointsDistance(b, 30), 1);
  assert.equal(C.pointsDistance(b, 249), 1);
  assert.equal(C.pointsDistance(b, 249.6), 1);
  assert.equal(C.pointsDistance(b, 250), 2);
  assert.equal(C.pointsDistance(b, 3499), 2);
  assert.equal(C.pointsDistance(b, 3500), 3);
  assert.equal(C.pointsDistance(b, 13000), 4);
  assert.equal(C.pointsCharge(b, { distance_km: 300, autres_enfants: 1, autres_enfants_superieur: 1 }), 2 + 2 + 4);
  assert.equal(C.pointsCharge(b, { distance_km: 10, handicap: true, aidant: true }), 8);
  assert.equal(C.pointsCharge(b, {}), 0);
});

test('apprenti : les 9 montants publiés par service-public', () => {
  for (const ex of B.apprenti.exemples_officiels) {
    const age = [16, 18, 21, 26][ex.tranche];
    assert.equal(C.salaireApprenti(B.apprenti, age, ex.annee).brut_mensuel, ex.montant, JSON.stringify(ex));
  }
});

test('apprenti : tranches d\'âge et 26 ans et plus au Smic', () => {
  assert.equal(C.trancheAge(15), 0);
  assert.equal(C.trancheAge(17), 0);
  assert.equal(C.trancheAge(20), 1);
  assert.equal(C.trancheAge(25), 2);
  assert.equal(C.trancheAge(26), 3);
  assert.equal(C.salaireApprenti(B.apprenti, 30, 1).brut_mensuel, B.apprenti.smic_mensuel_brut);
  assert.equal(C.round2((B.apprenti.smic_horaire_brut * 35 * 52) / 12), B.apprenti.smic_mensuel_brut);
  assert.throws(() => C.salaireApprenti(B.apprenti, 20, 4));
  assert.throws(() => C.trancheAge(10));
});

test('inscription : droits 2026-2027 et exonération des boursiers', () => {
  const b = B.inscription;
  assert.deepEqual(C.fraisInscription(b, 'licence', false), { droits: 178, cvec: 105, total: 283 });
  assert.deepEqual(C.fraisInscription(b, 'master', false), { droits: 255, cvec: 105, total: 360 });
  assert.deepEqual(C.fraisInscription(b, 'master', false, 'reduit'), { droits: 167, cvec: 105, total: 272 });
  assert.deepEqual(C.fraisInscription(b, 'doctorat', true), { droits: 0, cvec: 0, total: 0 });
  assert.throws(() => C.fraisInscription(b, 'inconnu', false));
});

test('mobilité master : les quatre conditions sont nécessaires', () => {
  const ok = { boursier: true, licence_nationale: true, m1_annee_suivante: true, change_region: true };
  assert.deepEqual(C.mobiliteMaster(B.mobilite_master, ok), { eligible: true, montant: 1000, manque: [] });
  for (const k of Object.keys(ok)) {
    const r = C.mobiliteMaster(B.mobilite_master, { ...ok, [k]: false });
    assert.equal(r.eligible, false);
    assert.equal(r.montant, 0);
    assert.equal(r.manque.length, 1);
  }
});

test('APL : loyers plafonds Caf au 1er octobre 2026', () => {
  const b = B.apl_loyers_plafonds;
  assert.deepEqual(C.loyerPlafondApl(b, 0, 0, false, 500), { plafond: 336.97, retenu: 336.97, au_dessus: 163.03 });
  assert.deepEqual(C.loyerPlafondApl(b, 1, 0, false, 250), { plafond: 293.68, retenu: 250, au_dessus: 0 });
  assert.equal(C.loyerPlafondApl(b, 2, 0, true, 300).plafond, 206.44);
  assert.equal(C.loyerPlafondApl(b, 1, 1, false, 900).plafond, 359.47);
  // le plafond de colocation vaut 75 % du plafond de location, à 2 centimes près
  b.location.forEach((ligne, i) => ligne.forEach((v, z) => assert.ok(Math.abs(v * 0.75 - b.colocation[i][z]) < 0.02, `ligne ${i} zone ${z}`)));
  // les plafonds baissent de la zone 1 à la zone 3 et montent avec la taille du foyer
  b.location.forEach((l, i) => { assert.ok(l[0] > l[1] && l[1] > l[2]); if (i) assert.ok(l[0] > b.location[i - 1][0]); });
  assert.throws(() => C.loyerPlafondApl(b, 5, 0, false, 100));
});

test('budget : additions et reste à vivre', () => {
  const r = C.budget({ bourse: 458.7, apl: 150, parents: 100 }, { loyer: 269, courses: 180, transport: 20.5 });
  assert.deepEqual(r, { revenus: 708.7, depenses: 469.5, reste: 239.2, part_logement: 37.96 });
  assert.equal(C.budget({}, {}).reste, 0);
  assert.equal(C.budget({ a: 0.1, b: 0.2 }, {}).revenus, 0.3);
  assert.throws(() => C.budget({ a: -1 }, {}));
});

test('loyer privé : indicateur au m² multiplié par la surface', () => {
  assert.equal(C.loyerPrive(17.4, 20), 348);
  assert.throws(() => C.loyerPrive(17.4, 0));
});
