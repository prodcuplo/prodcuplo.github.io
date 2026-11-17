// Formules de calcul, sans aucune dépendance. Le même fichier sert au site
// (navigateur) et aux tests automatiques (Node). Aucun barème n'est écrit ici :
// ils viennent tous de data/baremes.json.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
  const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

  // --- Gratification de stage -------------------------------------------
  // Due si le stage dépasse 308 heures (à partir de la 309e) ; montant = heures x taux.
  function gratificationStage(b, heures, tauxHoraire) {
    if (!isNum(heures) || heures < 0) throw new RangeError('heures invalides');
    const taux = isNum(tauxHoraire) && tauxHoraire > b.taux_horaire_min ? tauxHoraire : b.taux_horaire_min;
    const obligatoire = heures > b.seuil_heures;
    return {
      obligatoire,
      taux,
      total: obligatoire ? round2(heures * taux) : 0,
      total_si_versee: round2(heures * taux),
    };
  }

  // --- Bourse sur critères sociaux --------------------------------------
  function pointsDistance(b, km) {
    if (!isNum(km) || km < 0) throw new RangeError('distance invalide');
    km = Math.floor(km); // le barème est exprimé en kilomètres entiers
    for (const t of b.points_charge.distance) {
      if (km >= t.min_km && (t.max_km === null || km <= t.max_km)) return t.points;
    }
    return 0;
  }

  function pointsCharge(b, s) {
    const pc = b.points_charge;
    const enfants = s.autres_enfants || 0;
    const enfantsSup = s.autres_enfants_superieur || 0;
    if (enfants < 0 || enfantsSup < 0 || !Number.isInteger(enfants) || !Number.isInteger(enfantsSup)) throw new RangeError('nombre d\'enfants invalide');
    let p = pointsDistance(b, s.distance_km || 0);
    p += enfants * pc.par_enfant_a_charge + enfantsSup * pc.par_enfant_etudiant_superieur;
    if (s.handicap) p += pc.handicap_etudiant;
    if (s.aidant) p += pc.etudiant_aidant;
    return p;
  }

  // Renvoie l'échelon le plus élevé dont le plafond n'est pas dépassé, ou null.
  function echelonBourse(b, revenu, points) {
    if (!isNum(revenu) || revenu < 0) throw new RangeError('revenu invalide');
    if (!Number.isInteger(points) || points < 0) throw new RangeError('points invalides');
    const horsBareme = points > b.plafonds.length - 1;
    const ligne = b.plafonds[Math.min(points, b.plafonds.length - 1)];
    let idx = -1;
    for (let i = 0; i < ligne.length; i++) if (revenu <= ligne[i]) idx = i;
    if (idx < 0) return { eligible: false, points, hors_bareme: horsBareme, plafond_max: ligne[0] };
    const annuel = b.montants_annuels[idx];
    return {
      eligible: true,
      points,
      hors_bareme: horsBareme,
      echelon: b.echelons[idx],
      index: idx,
      annuel,
      mensuel: round2(annuel / b.nb_mensualites),
      plafond: ligne[idx],
    };
  }

  // --- Salaire minimum d'un apprenti ------------------------------------
  function trancheAge(age) {
    if (!isNum(age) || age < 15 || age > 99) throw new RangeError('âge invalide');
    if (age < 18) return 0; // moins de 16 ans : même rémunération que 16-17 ans
    if (age <= 20) return 1;
    if (age <= 25) return 2;
    return 3;
  }

  function salaireApprenti(b, age, annee) {
    if (![1, 2, 3].includes(annee)) throw new RangeError('année de contrat invalide');
    const t = trancheAge(age);
    const pct = b.pourcentages[annee - 1][t];
    // Smic mensuel non arrondi = taux horaire x 35 h x 52 semaines / 12 mois.
    const smic = (b.smic_horaire_brut * 35 * 52) / 12;
    const brut = round2((smic * pct) / 100);
    return { tranche: t, pourcentage: pct, brut_mensuel: brut };
  }

  // --- Frais d'inscription + CVEC ---------------------------------------
  function fraisInscription(b, formationId, boursier, taux) {
    const f = b.formations.find((x) => x.id === formationId);
    if (!f) throw new RangeError('formation inconnue');
    const droits = boursier ? 0 : taux === 'reduit' ? f.reduit : f.normal;
    const cvec = boursier ? 0 : b.cvec;
    return { droits, cvec, total: droits + cvec };
  }

  // --- Aide à la mobilité en master -------------------------------------
  function mobiliteMaster(b, s) {
    const manque = [];
    if (!s.boursier) manque.push('être bénéficiaire d\'une bourse sur critères sociaux ou d\'une allocation annuelle');
    if (!s.licence_nationale) manque.push('être titulaire du diplôme national de licence (une licence professionnelle ne suffit pas)');
    if (!s.m1_annee_suivante) manque.push('être inscrit en première année de master l\'année qui suit l\'obtention de la licence');
    if (!s.change_region) manque.push('être inscrit dans une région académique différente de celle de la licence');
    return { eligible: manque.length === 0, montant: manque.length === 0 ? b.montant : 0, manque };
  }

  // --- Loyer plafond pris en compte pour l'APL --------------------------
  function loyerPlafondApl(b, zone, composition, colocation, loyer) {
    const table = colocation ? b.colocation : b.location;
    if (!table[composition] || !isNum(table[composition][zone])) throw new RangeError('zone ou situation inconnue');
    if (!isNum(loyer) || loyer < 0) throw new RangeError('loyer invalide');
    const plafond = table[composition][zone];
    return { plafond, retenu: round2(Math.min(loyer, plafond)), au_dessus: round2(Math.max(0, loyer - plafond)) };
  }

  // --- Budget mensuel ----------------------------------------------------
  function budget(revenus, depenses) {
    const sum = (o) => Object.values(o).reduce((s, v) => {
      if (!isNum(v) || v < 0) throw new RangeError('montant invalide');
      return s + v;
    }, 0);
    const r = round2(sum(revenus));
    const d = round2(sum(depenses));
    return { revenus: r, depenses: d, reste: round2(r - d), part_logement: r > 0 && isNum(depenses.loyer) ? round2((depenses.loyer / r) * 100) : null };
  }

  // --- Loyer privé indicatif à partir de l'indicateur officiel au m² -----
  function loyerPrive(m2, surface) {
    if (!isNum(m2) || !isNum(surface) || surface <= 0 || surface > 200) throw new RangeError('surface invalide');
    return Math.round(m2 * surface);
  }

  return { round2, gratificationStage, pointsDistance, pointsCharge, echelonBourse, trancheAge, salaireApprenti, fraisInscription, mobiliteMaster, loyerPlafondApl, budget, loyerPrive };
});
