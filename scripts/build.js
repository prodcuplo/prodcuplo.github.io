#!/usr/bin/env node
// Générateur du site : lit data/*.json et écrit dist/. Aucune dépendance.
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../src/calc.js');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/baremes.json'), 'utf8'));
const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/villes.json'), 'utf8'));
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/site.json'), 'utf8'));
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// ---------- utilitaires ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const eur = (v, dec = 0) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
const eurA = (v) => eur(v, Number.isInteger(v) ? 0 : 2); // centimes seulement s'il y en a
const nb = (v, dec = 0) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
const dateFr = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const echSlug = (e) => 'echelon-' + e.replace(' ', '-');
const pages = [];

function sourcesBox(list, extra = '') {
  const li = list.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.titre)}</a>, ${esc(s.editeur)}${s.verifie_le ? `, page vérifiée par l'éditeur le ${dateFr(s.verifie_le)}` : ''}${s.note ? `. ${esc(s.note)}` : ''}</li>`).join('');
  return `<section class="sources" aria-labelledby="src"><h2 id="src">Sources officielles</h2><ul>${li}</ul>${extra}<p>Barèmes relus par nos soins le ${dateFr(CFG.baremes_relus_le)}. <a href="/sources-et-methode/">Notre méthode</a></p></section>`;
}
const officiel = (url, label) => `<div class="note"><p><strong>Ceci est une estimation.</strong> Seul le service officiel fait foi : <a href="${esc(url)}" rel="noopener">${esc(label)}</a>.</p></div>`;
const table = (caption, head, rows, numCols = []) => `<div class="table-wrap"><table>${caption ? `<caption>${esc(caption)}</caption>` : ''}<thead><tr>${head.map((h, i) => `<th scope="col"${numCols.includes(i) ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${c}</th>` : `<td${numCols.includes(i) ? ' class="num"' : ''}>${c}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
const field = (id, label, attrs = '', help = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" inputmode="decimal" type="number" ${attrs}>${help ? `<small>${help}</small>` : ''}</div>`;
const check = (id, label, attrs = '') => `<label class="check" for="${id}"><input type="checkbox" id="${id}" name="${id}" ${attrs}><span>${label}</span></label>`;
const submit = (label = 'Calculer') => `<div><button class="btn" type="submit">${label}</button></div>`;
const RESULT = '<div id="result" class="result" role="status" aria-live="polite" hidden></div>';

const NAV = [['/', 'Accueil'], ['/outils/', 'Simulateurs'], ['/villes/', 'Villes'], ['/sources-et-methode/', 'Sources']];
const FOOT = [['/sources-et-methode/', 'Sources et méthode'], ['/financement/', 'Comment ce site est financé'], ['/mentions-legales/', 'Mentions légales'], ['/confidentialite/', 'Confidentialité et cookies']];

function page(p) {
  const url = CFG.url + p.path;
  const crumbs = p.crumbs || [];
  const ld = [];
  if (crumbs.length) {
    ld.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['/', 'Accueil'], ...crumbs, [p.path, p.short || p.h1]].map(([u, n], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: CFG.url + u })) });
  }
  if (p.tool) {
    ld.push({ '@context': 'https://schema.org', '@type': 'WebApplication', name: p.h1, url, description: p.description, applicationCategory: 'FinanceApplication', operatingSystem: 'Tous', inLanguage: 'fr', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } });
  }
  if (p.path === '/') ld.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: CFG.nom, url: CFG.url + '/', inLanguage: 'fr', description: p.description });
  (p.ld || []).forEach((x) => ld.push(x));
  const consent = CFG.consentement_requis ? ' data-consent="1"' : '';
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${esc(url)}">
${p.noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="${esc(CFG.nom)}">
${CFG.verification_google ? `<meta name="google-site-verification" content="${esc(CFG.verification_google)}">` : ''}
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/style.css?v=${CFG.version_assets}">
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body${p.tool ? ` data-tool="${p.tool}"` : ''}${consent}>
<a class="skip" href="#contenu">Aller au contenu</a>
<header class="site"><div class="wrap"><a class="brand" href="/">${esc(CFG.nom)}</a><nav class="main" aria-label="Navigation principale">${NAV.map(([u, n]) => `<a href="${u}">${n}</a>`).join('')}</nav></div></header>
<main id="contenu"><div class="wrap">
${crumbs.length ? `<nav class="crumbs" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › ${crumbs.map(([u, n]) => `<a href="${u}">${esc(n)}</a> › `).join('')}${esc(p.short || p.h1)}</nav>` : ''}
<h1>${esc(p.h1)}</h1>
${p.body}
</div></main>
<footer class="site"><div class="wrap"><nav aria-label="Informations">${FOOT.map(([u, n]) => `<a href="${u}">${n}</a>`).join('')}</nav><p>${esc(CFG.nom)} est un site indépendant. Il n'est lié ni à l'État, ni à la Caf, ni aux Crous. Les résultats sont des estimations : seuls les services officiels font foi.</p><p>Page générée le ${dateFr(BUILD_DATE)}.</p></div></footer>
${p.data ? `<script id="page-data" type="application/json">${JSON.stringify(p.data).replace(/</g, '\\u003c')}</script>` : ''}
${p.tool || CFG.consentement_requis ? `<script src="/assets/calc.js?v=${CFG.version_assets}" defer></script><script src="/assets/ui.js?v=${CFG.version_assets}" defer></script>` : ''}
</body>
</html>
`;
  pages.push({ path: p.path, html, noindex: !!p.noindex, title: p.title, description: p.description });
}

// ---------- outils ----------
const TOOLS = [];
function tool(t) { TOOLS.push(t); }

// 1. Gratification de stage
{
  const b = B.gratification_stage;
  tool({
    path: '/outils/gratification-stage/', short: 'Gratification de stage', card: 'Montant minimum à recevoir selon vos heures de stage.',
    title: `Gratification de stage 2026 : calcul du montant minimum (${nb(b.taux_horaire_min, 2)} €/h)`,
    description: `Calculez la gratification minimale d'un stage en 2026 : ${nb(b.taux_horaire_min, 2)} € par heure, obligatoire à partir de la 309e heure. Formule et source officielle.`,
    h1: 'Gratification de stage : combien devez-vous recevoir ?', tool: 'stage', data: { b },
    body: `<p class="lead">En 2026, un stagiaire reçoit au minimum ${nb(b.taux_horaire_min, 2)} € par heure de présence dès que son stage dépasse ${b.seuil_heures} heures dans le même organisme. Indiquez votre durée pour obtenir le total.</p>
<div class="card"><form id="calc" class="calc" novalidate>
<div class="cols">${field('jours', 'Jours de présence', 'min="0" step="1" placeholder="63"')}${field('heures_jour', 'Heures par jour', 'min="0" max="24" step="0.5" value="7"')}</div>
${field('heures', 'Ou nombre total d\'heures', 'min="0" step="0.5"', 'Si vous remplissez ce champ, il remplace les jours.')}
<div class="cols">${field('taux', 'Taux horaire prévu par votre convention (facultatif)', `min="0" step="0.01" placeholder="${b.taux_horaire_min}"`, 'Une convention de branche peut prévoir plus que le minimum légal.')}${field('mois', 'Nombre de mois du stage (facultatif)', 'min="1" max="6" step="1"', 'Pour connaître le montant lissé par mois.')}</div>
${submit()}</form>${RESULT}</div>
${officiel(b.simulateur_officiel, 'simulateur de gratification de service-public.gouv.fr')}
<h2>Comment le montant est calculé</h2>
<p>La gratification est due quand le stage dure ${esc(b.seuil_texte)}. En dessous, l'organisme d'accueil n'a pas l'obligation de payer.</p>
<p>Le calcul est simple : <strong>nombre d'heures de présence effective × ${nb(b.taux_horaire_min, 2)} €</strong>. Ce taux correspond à 15 % du plafond horaire de la sécurité sociale (30 € × 0,15). Dès que le seuil est dépassé, la gratification est due pour toutes les heures, depuis le premier jour.</p>
<p>L'organisme peut verser la somme selon les heures réelles de chaque mois, ou la lisser en mensualités égales. Le total est le même.</p>
<h3>L'exemple donné par l'administration</h3>
<p>Pour un stage à temps plein du 1<sup>er</sup> janvier au 31 mars 2026 (147 h + 140 h + 154 h), le total est de ${b.exemple_officiel.heures} heures, soit ${eur(b.exemple_officiel.montant, 2)}. Notre calculateur est testé automatiquement sur cet exemple.</p>
${table('Gratification minimale pour un stage à 7 heures par jour', ['Durée', 'Heures', 'Montant minimum'], [[44, '2 mois (44 jours)'], [66, '3 mois (66 jours)'], [88, '4 mois (88 jours)'], [110, '5 mois (110 jours)'], [132, '6 mois (132 jours)']].map(([j, l]) => { const r = C.gratificationStage(b, j * 7); return [l, nb(j * 7) + ' h', r.obligatoire ? eur(r.total, 2) : 'Non obligatoire (' + eur(r.total_si_versee, 2) + ' si versée)']; }), [1, 2])}
<p class="muted">Le tableau compte 22 jours de présence par mois. Votre nombre réel de jours dépend du calendrier et de vos absences.</p>
<h2>Cotisations et impôt</h2>
<p>Tant que le taux horaire ne dépasse pas ${nb(b.taux_horaire_min, 2)} €, la gratification est exonérée de cotisations sociales, de CSG et de CRDS : le montant brut est le montant que vous recevez. La part au-dessus de ce taux est soumise à cotisations.</p>
${sourcesBox([b.source])}`,
  });
}

// 2. Échelon de bourse
{
  const b = B.bourse;
  const pc = b.points_charge;
  tool({
    path: '/outils/echelon-bourse/', short: 'Échelon de bourse Crous', card: 'Échelon et montant de la bourse sur critères sociaux 2026-2027.',
    title: `Simulateur d'échelon de bourse Crous ${b.annee} : montant et plafonds`,
    description: `Estimez votre échelon de bourse sur critères sociaux ${b.annee} à partir du revenu brut global et des points de charge. Barème officiel complet.`,
    h1: `Bourse Crous ${b.annee} : estimez votre échelon`, tool: 'bourse', data: { b },
    body: `<p class="lead">L'échelon dépend de deux éléments : le revenu brut global de vos parents et vos points de charge. Remplissez le formulaire pour obtenir l'échelon et le montant correspondants.</p>
<div class="card"><form id="calc" class="calc" novalidate>
${field('revenu', 'Revenu brut global de la famille (en euros)', 'min="0" step="1" required', `Pour ${b.annee} : ${esc(b.revenus_retenus)}. Ligne « revenu brut global » de l'avis d'imposition.`)}
${field('distance', 'Distance entre le domicile familial et le lieu d\'études (en km)', 'min="0" step="1" value="0"', 'La distance officielle est calculée par le Crous avec les outils de l\'IGN.')}
<div class="cols">${field('enfants', 'Autres enfants à charge fiscale de la famille, non étudiants', 'min="0" max="15" step="1" value="0"', 'Sans vous compter.')}${field('enfants_sup', 'Autres enfants à charge, étudiants dans le supérieur', 'min="0" max="15" step="1" value="0"', 'Sans vous compter.')}</div>
<fieldset><legend>Situations particulières</legend>${check('handicap', 'Je suis en situation de handicap, avec une notification de la CDAPH en cours de validité')}${check('aidant', 'J\'aide, sans être salarié pour cela, un parent en situation de handicap ou en perte d\'autonomie')}</fieldset>
${submit('Estimer mon échelon')}</form>${RESULT}</div>
${officiel(b.simulateur_officiel, 'simulateur de bourse officiel')}
<h2>Montant de la bourse par échelon en ${b.annee}</h2>
${table('', ['Échelon', 'Montant annuel', `Par mois sur ${b.nb_mensualites} mois`], b.echelons.map((e, i) => [`<a href="/bourse/${echSlug(e)}/">Échelon ${e}</a>`, eur(b.montants_annuels[i]), eur(b.montants_annuels[i] / b.nb_mensualites, 2)]), [1, 2])}
<p>La bourse est versée en ${b.nb_mensualites} mensualités. Pour des études en outre-mer, le montant annuel est majoré de ${eur(b.majoration_outre_mer)}.</p>
<h2>Comment sont comptés les points de charge</h2>
${table('', ['Situation', 'Points'], [...pc.distance.map((d) => [d.max_km ? `Domicile familial situé de ${nb(d.min_km)} à ${nb(d.max_km)} km du lieu d'études` : `Domicile familial à ${nb(d.min_km)} km ou plus`, String(d.points)]), ['Pour chaque autre enfant à charge fiscale, hors candidat', String(pc.par_enfant_a_charge)], ['Pour chaque autre enfant à charge étudiant dans le supérieur', String(pc.par_enfant_etudiant_superieur)], ['Étudiant en situation de handicap (notification CDAPH valide)', String(pc.handicap_etudiant)], ['Étudiant aidant d\'un parent en situation de handicap ou en perte d\'autonomie', `${pc.etudiant_aidant} au maximum`]], [1])}
<h2>Plafonds de ressources ${b.annee}</h2>
<p>Pour chaque nombre de points de charge, le tableau donne le revenu brut global maximum de chaque échelon. On retient l'échelon le plus élevé dont le plafond n'est pas dépassé.</p>
${table('Revenu brut global maximum, en euros', ['Points', ...b.echelons.map((e) => 'Éch. ' + e)], b.plafonds.map((l, p) => [String(p), ...l.map((x) => nb(x))]), [1, 2, 3, 4, 5, 6, 7, 8])}
<div class="note"><p>Ce simulateur ne traite pas tous les cas : parents séparés, étudiant indépendant fiscalement, baisse récente de revenus, étudiants étrangers. Dans ces situations, le Crous applique des règles particulières prévues par la circulaire.</p></div>
${sourcesBox(b.sources)}`,
  });

  // une page par échelon : montant et fourchette de revenus selon les points
  b.echelons.forEach((e, i) => {
    const annuel = b.montants_annuels[i];
    const rows = b.plafonds.map((l, p) => {
      const haut = l[i];
      const bas = i < 7 ? l[i + 1] + 1 : 0;
      return [String(p), nb(bas) + ' €', nb(haut) + ' €'];
    });
    page({
      path: `/bourse/${echSlug(e)}/`, short: `Échelon ${e}`, crumbs: [['/outils/', 'Simulateurs'], ['/outils/echelon-bourse/', 'Échelon de bourse']],
      title: `Bourse Crous échelon ${e} en ${b.annee} : ${nb(annuel)} € par an, plafonds de revenus`,
      description: `Échelon ${e} de la bourse sur critères sociaux ${b.annee} : ${nb(annuel)} € par an, soit ${nb(annuel / b.nb_mensualites, 2)} € par mois. Revenus correspondants selon les points de charge.`,
      h1: `Bourse échelon ${e} : montant et plafonds de revenus ${b.annee}`,
      body: `<p class="lead">À l'échelon ${e}, la bourse sur critères sociaux est de ${eur(annuel)} pour l'année ${b.annee}.</p>
<ul class="kpis"><li><b>${eur(annuel)}</b><span>par an</span></li><li><b>${eur(annuel / b.nb_mensualites, 2)}</b><span>par mois, sur ${b.nb_mensualites} mois</span></li><li><b>${eur(annuel + b.majoration_outre_mer)}</b><span>par an pour des études en outre-mer</span></li></ul>
<h2>Quels revenus correspondent à l'échelon ${e} ?</h2>
<p>La fourchette dépend de vos points de charge. Le revenu retenu est le ${esc(b.revenus_retenus)}.</p>
${table(`Revenu brut global correspondant à l'échelon ${e}`, ['Points de charge', 'Revenu minimum', 'Revenu maximum'], rows, [1, 2])}
<p>${i < 7 ? `Avec un revenu inférieur au minimum, vous relevez de l'échelon ${b.echelons[i + 1]}, plus favorable.` : 'L\'échelon 7 est le plus élevé.'} ${i > 0 ? `Avec un revenu supérieur au maximum, vous relevez de l'échelon ${b.echelons[i - 1]}.` : 'Au-dessus du revenu maximum, le barème ne prévoit pas de bourse sur critères sociaux.'}</p>
<p><a class="btn" href="/outils/echelon-bourse/">Calculer mes points et mon échelon</a></p>
<h2>Les autres échelons</h2>
<ul class="grid">${b.echelons.map((x, j) => (j === i ? '' : `<li><a href="/bourse/${echSlug(x)}/"><strong>Échelon ${x}</strong><span>${eur(b.montants_annuels[j])} par an</span></a></li>`)).join('')}</ul>
${officiel(b.simulateur_officiel, 'simulateur de bourse officiel')}
${sourcesBox(b.sources)}`,
    });
  });
}

// 3. Salaire apprenti
{
  const b = B.apprenti;
  tool({
    path: '/outils/salaire-apprenti/', short: 'Salaire d\'un apprenti', card: 'Salaire minimum en apprentissage selon l\'âge et l\'année.',
    title: 'Salaire minimum d\'un apprenti en 2026 selon l\'âge et l\'année de contrat',
    description: `Calculez le salaire minimum brut d'un apprenti en 2026 : pourcentage du Smic (${nb(b.smic_mensuel_brut, 2)} €) selon l'âge et l'année du contrat. Grille officielle.`,
    h1: 'Salaire d\'un apprenti : le minimum légal selon votre âge', tool: 'apprenti', data: { b },
    body: `<p class="lead">Un apprenti est payé en pourcentage du Smic. Le pourcentage monte avec l'âge et avec l'année du contrat.</p>
<div class="card"><form id="calc" class="calc" novalidate><div class="cols">
${field('age', 'Votre âge', 'min="15" max="99" step="1" required')}
<div class="field"><label for="annee">Année du contrat</label><select id="annee" name="annee"><option value="1">1re année</option><option value="2">2e année</option><option value="3">3e année</option></select><small>Une licence professionnelle en 1 an est payée comme une 2e année.</small></div>
</div>${submit()}</form>${RESULT}</div>
${officiel(b.simulateur_officiel, 'fiche « Contrat d\'apprentissage » de service-public.gouv.fr')}
<h2>Grille des salaires minimums</h2>
${table(`Salaire brut mensuel minimum, Smic à ${nb(b.smic_mensuel_brut, 2)} €`, ['Année du contrat', ...b.tranches_age], b.pourcentages.map((l, a) => [`${a + 1}${a === 0 ? 're' : 'e'} année`, ...l.map((pct, t) => `${pct} %, soit ${eur(C.salaireApprenti(b, [16, 18, 21, 26][t], a + 1).brut_mensuel, 2)}`)]), [1, 2, 3, 4])}
<p>Les apprentis de moins de 16 ans sont payés comme les 16 à 17 ans. À partir de 21 ans, l'employeur retient le montant le plus élevé entre le pourcentage du Smic et le même pourcentage du salaire minimum conventionnel de l'emploi. Si votre anniversaire vous fait changer de tranche, le nouveau taux s'applique le premier jour du mois suivant.</p>
<h2>Brut ou net ?</h2>
<p>Le salaire d'un apprenti est exonéré de cotisations salariales dans une certaine limite, fixée en pourcentage du Smic selon la date de signature du contrat. Sous cette limite, le net est très proche du brut. Les seuils exacts figurent dans la fiche officielle.</p>
${sourcesBox([b.source], `<p>${esc(b.note_smic)}</p>`)}`,
  });
}

// 4. Frais d'inscription + CVEC
{
  const b = B.inscription;
  tool({
    path: '/outils/frais-inscription-cvec/', short: 'Frais d\'inscription et CVEC', card: 'Total à payer à l\'université, avec ou sans bourse.',
    title: `Frais d'inscription université ${b.annee} et CVEC : combien payer ?`,
    description: `Droits d'inscription ${b.annee} en licence (${b.formations[0].normal} €), master (${b.formations[1].normal} €), doctorat, et CVEC (${b.cvec} €). Exonération des boursiers.`,
    h1: `Frais d'inscription et CVEC ${b.annee} : votre total`, tool: 'inscription', data: { b },
    body: `<p class="lead">Dans une université publique, vous payez des droits d'inscription fixés par l'État et la contribution de vie étudiante et de campus (CVEC). Les boursiers sur critères sociaux ne paient ni l'un ni l'autre.</p>
<div class="card"><form id="calc" class="calc" novalidate>
<div class="field"><label for="formation">Diplôme préparé</label><select id="formation" name="formation">${b.formations.map((f) => `<option value="${f.id}">${esc(f.nom)}</option>`).join('')}</select></div>
<fieldset><legend>Votre situation</legend>${check('boursier', 'Je suis boursier sur critères sociaux')}${check('reduit', 'C\'est ma deuxième inscription dans le même établissement cette année (taux réduit)')}</fieldset>
${submit()}</form>${RESULT}</div>
${officiel(b.lien_officiel, 'payer ou se faire exonérer de la CVEC sur cvec.etudiant.gouv.fr')}
<h2>Droits d'inscription ${b.annee}</h2>
${table('', ['Diplôme', 'Taux normal', 'Taux réduit'], b.formations.map((f) => [esc(f.nom), eur(f.normal), eur(f.reduit)]), [1, 2])}
<p>Le taux réduit s'applique à partir du deuxième diplôme préparé dans le même établissement. L'inscription en BTS public est gratuite. Les écoles et diplômes d'établissement fixent librement leurs tarifs : ils ne figurent pas ici.</p>
<h2>La CVEC : ${eur(b.cvec)}</h2>
<p>La CVEC est due avant l'inscription par les étudiants en formation initiale, y compris en apprentissage et en classe préparatoire. Elle n'est pas due en BTS, ni en formation continue financée par un employeur. Les boursiers sur critères sociaux en sont exonérés. Si vous devenez boursier en cours d'année, vous pouvez demander le remboursement avant le 31 mai.</p>
<p>D'autres exonérations existent, par exemple pour les réfugiés et les demandeurs d'asile. Les étudiants étrangers hors Union européenne peuvent relever de droits d'inscription différents : vérifiez auprès de votre établissement.</p>
${sourcesBox([b.source])}`,
  });
}

// 5. Aide à la mobilité master
{
  const b = B.mobilite_master;
  tool({
    path: '/outils/aide-mobilite-master/', short: 'Aide à la mobilité master', card: `${nb(b.montant)} € pour changer de région en master 1 : y avez-vous droit ?`,
    title: `Aide à la mobilité master : ai-je droit aux ${nb(b.montant)} € ?`,
    description: `Vérifiez en quatre questions si vous remplissez les conditions de l'aide à la mobilité en master de ${nb(b.montant)} € : boursier, licence, master 1, changement de région académique.`,
    h1: `Aide à la mobilité en master : avez-vous droit aux ${nb(b.montant)} € ?`, tool: 'mobilite', data: { b },
    body: `<p class="lead">Cette aide de ${eur(b.montant)} est destinée aux étudiants boursiers qui changent de région académique entre la licence et le master 1. Cochez ce qui vous correspond.</p>
<div class="card"><form id="calc" class="calc" novalidate><fieldset><legend>Vos conditions</legend>
${check('c1', 'Je touche une bourse sur critères sociaux ou une allocation annuelle des aides spécifiques')}
${check('c2', 'J\'ai obtenu un diplôme national de licence (pas une licence professionnelle)')}
${check('c3', 'Je suis inscrit en première année de master l\'année qui suit l\'obtention de ma licence')}
${check('c4', 'Mon master est dans une autre région académique que celle où j\'ai obtenu ma licence')}
</fieldset>${submit('Vérifier')}</form>${RESULT}</div>
${officiel(b.source.url, 'page « Aide à la mobilité en master » d\'etudiant.gouv.fr')}
<h2>Ce qu'il faut savoir</h2>
<p>Le montant est de ${eur(b.montant)}, versé en une seule fois, en début de mois, après l'instruction de votre dossier de bourse.</p>
<p>La région académique n'est pas l'académie : plusieurs académies peuvent former une seule région académique. Par exemple, passer d'Aix-Marseille à Nice ne change pas de région académique. La carte officielle figure sur la page d'etudiant.gouv.fr.</p>
<p>Une licence professionnelle ou une équivalence de grade n'ouvre pas droit à cette aide : il faut le diplôme national de licence.</p>
${sourcesBox([b.source, { titre: b.texte.titre + ' relatif à l\'aide à la mobilité en master', editeur: 'Légifrance', url: b.texte.url }])}`,
  });
}

// 6. Loyer plafond APL
{
  const b = B.apl_loyers_plafonds;
  tool({
    path: '/outils/plafond-loyer-apl/', short: 'Loyer plafond APL', card: 'La part de votre loyer que la Caf prend en compte.',
    title: 'APL étudiant : quel loyer plafond la Caf prend-elle en compte ?',
    description: `Loyers plafonds des aides au logement au ${dateFr(b.date_effet)} : ${nb(b.location[0][0], 2)} € en zone 1, ${nb(b.location[0][1], 2)} € en zone 2, ${nb(b.location[0][2], 2)} € en zone 3 pour une personne seule.`,
    h1: 'APL : la part de votre loyer prise en compte par la Caf', tool: 'apl', data: { b },
    body: `<p class="lead">La Caf ne calcule pas l'aide au logement sur tout votre loyer : elle s'arrête à un loyer plafond, qui dépend de la zone et de votre situation. Au-dessus, payer plus cher n'augmente pas l'aide.</p>
<div class="card"><form id="calc" class="calc" novalidate>
${field('loyer', 'Votre loyer mensuel hors charges (en euros)', 'min="0" step="1" required')}
<div class="cols"><div class="field"><label for="zone">Zone de votre commune</label><select id="zone" name="zone">${b.zones.map((z, i) => `<option value="${i}"${i === 1 ? ' selected' : ''}>${z}</option>`).join('')}</select><small><a href="${esc(b.zonage_officiel)}" rel="noopener">Trouver la zone de ma commune (service officiel)</a></small></div>
<div class="field"><label for="compo">Votre foyer</label><select id="compo" name="compo">${b.compositions.map((z, i) => `<option value="${i}">${z}</option>`).join('')}</select></div></div>
${check('coloc', 'Je suis en colocation')}
${submit()}</form>${RESULT}</div>
<div class="note"><p><strong>Cet outil ne donne pas le montant de votre APL.</strong> Le calcul complet dépend de vos ressources et de nombreux paramètres : nous ne publions pas d'estimation que nous ne pouvons pas vérifier. Pour le montant, utilisez le <a href="${esc(b.simulateur_officiel)}" rel="noopener">simulateur officiel de la Caf</a>.</p></div>
<h2>Loyers plafonds au ${dateFr(b.date_effet)}</h2>
${table('Loyer mensuel maximum pris en compte, en location', ['Foyer', ...b.zones], b.compositions.map((c, i) => [c, ...b.location[i].map((x) => eur(x, 2))]), [1, 2, 3])}
${table('Loyer mensuel maximum pris en compte, en colocation', ['Foyer', ...b.zones], b.compositions.map((c, i) => [c, ...b.colocation[i].map((x) => eur(x, 2))]), [1, 2, 3])}
<p>La zone 1 correspond à l'agglomération parisienne, la zone 2 aux grandes agglomérations et à la Corse, la zone 3 au reste du territoire. En cas de doute, le service officiel indique la zone de chaque commune.</p>
<h2>Étudiants étrangers : une règle nouvelle depuis juillet 2026</h2>
<p>Depuis le 1<sup>er</sup> juillet 2026, un étudiant ressortissant d'un pays hors Union européenne, Espace économique européen ou Suisse, avec un titre de séjour pour études, ne peut toucher l'APL que dans trois cas : il perçoit une bourse sur critères sociaux, il exerce une activité professionnelle, ou il est en contrat d'apprentissage ou de professionnalisation.</p>
${sourcesBox([b.source, b.source_conditions])}`,
  });
}

// 7. Budget
{
  const R = [['bourse', 'Bourse'], ['apl', 'Aide au logement (APL, ALS)'], ['famille', 'Aide de la famille'], ['salaire', 'Salaire, job, stage, alternance'], ['autres_r', 'Autres revenus']];
  const Dp = [['loyer', 'Loyer et charges'], ['energie', 'Électricité, gaz, eau'], ['assurance', 'Assurance habitation'], ['telecom', 'Téléphone et internet'], ['courses', 'Alimentation'], ['transport', 'Transports'], ['sante', 'Santé, mutuelle'], ['loisirs', 'Sorties, sport, abonnements'], ['autres_d', 'Autres dépenses']];
  const f = (t) => ([k, l]) => `<div class="field"><label for="b_${k}">${l}</label><input id="b_${k}" type="number" inputmode="decimal" min="0" step="1" data-k="${k}" data-t="${t}" data-label="${esc(l)}" placeholder="0"></div>`;
  tool({
    path: '/outils/budget-etudiant/', short: 'Budget étudiant mensuel', card: 'Votre reste à vivre mensuel, calculé dans votre navigateur.',
    title: 'Calculateur de budget étudiant mensuel : votre reste à vivre',
    description: 'Calculez votre budget étudiant mensuel : revenus, loyer, courses, transports, frais annuels lissés. Le reste à vivre s\'affiche sans aucune donnée envoyée.',
    h1: 'Budget étudiant : calculez votre reste à vivre', tool: 'budget', data: {},
    body: `<p class="lead">Saisissez vos revenus et vos dépenses du mois. Le calcul se fait dans votre navigateur : rien n'est envoyé ni enregistré.</p>
<div class="card"><form id="calc" class="calc" novalidate>
<fieldset><legend>Revenus par mois</legend><div class="cols">${R.map(f('r')).join('')}</div></fieldset>
<fieldset><legend>Dépenses par mois</legend><div class="cols">${Dp.map(f('d')).join('')}</div></fieldset>
${field('annuels', 'Frais payés une fois par an (inscription, CVEC, assurance annuelle…)', 'min="0" step="1" placeholder="0"', 'Le total est divisé par 12 et ajouté aux dépenses du mois.')}
${submit('Calculer mon reste à vivre')}</form>${RESULT}</div>
<h2>Les montants officiels utiles pour remplir</h2>
<ul>
<li><a href="/outils/echelon-bourse/">Bourse</a> : de ${eur(B.bourse.montants_annuels[0] / 10, 2)} à ${eur(B.bourse.montants_annuels[7] / 10, 2)} par mois sur 10 mois selon l'échelon. Attention, elle n'est pas versée en juillet et en août, sauf cas particuliers.</li>
<li><a href="/outils/frais-inscription-cvec/">Frais annuels</a> : ${eur(B.inscription.formations[0].normal)} en licence ou ${eur(B.inscription.formations[1].normal)} en master, plus ${eur(B.inscription.cvec)} de CVEC, sauf pour les boursiers.</li>
<li><a href="/outils/gratification-stage/">Stage</a> : ${nb(B.gratification_stage.taux_horaire_min, 2)} € par heure au minimum au-delà de deux mois.</li>
<li>Loyer : consultez les <a href="/villes/">loyers Crous et privés de votre ville</a>.</li>
</ul>
<h2>Si le budget ne tient pas</h2>
<p>Un reste à vivre négatif n'est pas une fatalité. Le service social du Crous reçoit tous les étudiants, boursiers ou non, et peut accorder une aide ponctuelle. Vous pouvez aussi vérifier vos droits à une aide au logement sur le site de la Caf.</p>
<section class="sources"><h2>Méthode</h2><p>Cet outil additionne vos montants et soustrait les dépenses des revenus. Il ne contient aucun barème caché et aucune moyenne inventée. Les montants cités ci-dessus viennent des sources officielles détaillées sur chaque page d'outil.</p></section>`,
  });
}

// ---------- villes ----------
const priveResume = (v) => {
  const ms = v.prive.lignes.map((l) => l.m2);
  return { min: Math.min(...ms), max: Math.max(...ms) };
};
const crousResume = (v) => ({ min: Math.min(...v.residences.map((r) => r.min)), max: Math.max(...v.residences.map((r) => r.max)) });
const compact = (v) => ({ n: v.nom, min: crousResume(v).min, l: v.prive.lignes.map((l) => ({ n: l.nom, m: Math.round(l.m2 * 100) / 100 })) });
const SRC_VILLES = [
  { titre: V.sources.crous.titre, editeur: V.sources.crous.editeur, url: V.sources.crous.page },
  { titre: V.sources.loyers.titre, editeur: V.sources.loyers.editeur + '. ' + V.sources.loyers.mention, url: V.sources.loyers.page },
];
const LIMITES = `<div class="note"><p><strong>Limites de ces chiffres.</strong> Les tarifs Crous sont recopiés tels qu'ils figurent dans les fiches publiées par les Crous : certains datent d'une année précédente, et toutes les résidences n'affichent pas leurs tarifs. L'indicateur de loyer privé est une estimation du ministère pour un appartement T1-T2 non meublé de ${V.sources.loyers.surface_reference} m², charges comprises, au ${V.sources.loyers.millesime} : ce n'est ni une moyenne ni un prix garanti. Un petit studio ou un meublé coûte souvent plus cher au m².</p></div>`;

// 8. Comparateur Crous / privé
tool({
  path: '/outils/crous-ou-prive/', short: 'Crous ou logement privé', card: 'Comparez un loyer Crous au loyer privé de votre ville.',
  title: 'Crous ou logement privé : comparez les loyers dans votre ville étudiante',
  description: `Comparez le loyer d'une résidence Crous et le loyer privé estimé dans ${V.villes.length} villes étudiantes, à partir des données ouvertes des Crous et du ministère du Logement.`,
  h1: 'Résidence Crous ou logement privé : comparez les loyers', tool: 'compare', data: { villes: V.villes.map(compact) },
  body: `<p class="lead">Choisissez une ville et une surface : l'outil estime le loyer privé à partir de l'indicateur officiel au m² et le compare à un loyer Crous.</p>
<div class="card"><form id="calc" class="calc" novalidate>
<div class="cols"><div class="field"><label for="ville">Ville</label><select id="ville" name="ville">${V.villes.map((v) => `<option>${esc(v.nom)}</option>`).join('')}</select></div>
<div class="field" id="arr-field" hidden><label for="arr">Arrondissement</label><select id="arr" name="arr"></select></div></div>
<div class="cols">${field('surface', 'Surface du logement privé (en m²)', 'min="9" max="200" step="1" value="20" required')}${field('crous', 'Loyer Crous à comparer (en euros par mois)', 'min="0" step="1" required', 'Prérempli avec le tarif le plus bas relevé dans la ville. Modifiez-le avec le tarif de la résidence visée.')}</div>
${submit('Comparer')}</form>${RESULT}</div>
${LIMITES}
<h2>Les ${V.villes.length} villes couvertes</h2>
${table('', ['Ville', 'Tarifs Crous relevés', 'Loyer privé T1-T2, par m²'], V.villes.map((v) => { const c = crousResume(v), p = priveResume(v); return [`<a href="/villes/${v.slug}/">${esc(v.nom)}</a>`, `de ${eurA(c.min)} à ${eurA(c.max)}`, p.min === p.max ? `${nb(p.min, 1)} €` : `de ${nb(p.min, 1)} à ${nb(p.max, 1)} €`]; }), [1, 2])}
<p>Une ville n'apparaît que si au moins trois de ses résidences Crous publient leurs tarifs dans le jeu de données officiel.</p>
<p>Pour demander un logement Crous, la démarche officielle passe par <a href="https://trouverunlogement.lescrous.fr/" rel="noopener">trouverunlogement.lescrous.fr</a> et par le dossier social étudiant.</p>
${sourcesBox(SRC_VILLES)}`,
});

V.villes.forEach((v) => {
  const c = crousResume(v), p = priveResume(v);
  const arr = v.prive.type === 'arrondissements';
  const l0 = v.prive.lignes[0];
  const ref20 = (m) => Math.round(m * 20);
  const prudence = v.prive.lignes.some((l) => l.r2 < 0.5 || l.nbobs < 30 || l.maille);
  const priveTxt = arr ? `de ${nb(p.min, 1)} à ${nb(p.max, 1)} €/m² selon l'arrondissement` : `${nb(p.min, 1)} €/m²`;
  page({
    path: `/villes/${v.slug}/`, short: v.nom, crumbs: [['/villes/', 'Villes']], tool: 'compare', data: { villes: [compact(v)] },
    title: `Logement étudiant à ${v.nom} : loyers des résidences Crous et loyers privés`,
    description: `À ${v.nom}, ${v.residences.length} résidences Crous publient leurs tarifs, de ${nb(c.min, Number.isInteger(c.min) ? 0 : 2)} à ${nb(c.max, Number.isInteger(c.max) ? 0 : 2)} € par mois. Loyer privé estimé : ${priveTxt}. Données officielles.`,
    h1: `Se loger étudiant à ${v.nom} : Crous ou privé ?`,
    body: `<p class="lead">${v.residences.length} résidences Crous de ${esc(v.nom)} publient leurs tarifs. Voici ces tarifs, et l'indicateur officiel des loyers privés de la commune pour comparer.</p>
<ul class="kpis"><li><b>${eurA(c.min)} à ${eurA(c.max)}</b><span>tarifs mensuels relevés dans les fiches Crous</span></li><li><b>${arr ? `${nb(p.min, 1)} à ${nb(p.max, 1)} €` : `${nb(p.min, 1)} €`}</b><span>par m², loyer privé T1-T2 charges comprises</span></li><li><b>${arr ? `${eur(ref20(p.min))} à ${eur(ref20(p.max))}` : `environ ${eur(ref20(p.min))}`}</b><span>par mois pour 20 m² dans le privé, ordre de grandeur</span></li></ul>
<h2>Comparer pour votre logement</h2>
<div class="card"><form id="calc" class="calc" novalidate>
<div class="field" id="arr-field" hidden><label for="arr">Arrondissement</label><select id="arr" name="arr"></select></div>
<div class="cols">${field('surface', 'Surface du logement privé (en m²)', 'min="9" max="200" step="1" value="20" required')}${field('crous', 'Loyer Crous à comparer (en euros par mois)', `min="0" step="1" value="${c.min}" required`, 'Prérempli avec le tarif le plus bas relevé. Remplacez-le par celui de la résidence visée.')}</div>
${submit('Comparer')}</form>${RESULT}</div>
${LIMITES}
<h2>Tarifs des résidences Crous à ${esc(v.nom)}</h2>
<p>Les lignes de tarif sont recopiées mot pour mot depuis la fiche de chaque résidence.${v.nb_residences_total > v.residences.length ? ` ${v.nb_residences_total - v.residences.length} autre${v.nb_residences_total - v.residences.length > 1 ? 's résidences ne publient' : ' résidence ne publie'} pas de tarif et ne figure${v.nb_residences_total - v.residences.length > 1 ? 'nt' : ''} pas ici.` : ''}</p>
${table('', ['Résidence', 'Tarifs publiés dans la fiche officielle', 'Date indiquée'], v.residences.map((r) => [`${esc(r.nom)}<br><span class="muted">${esc(r.adresse)}</span>`, `<ul>${r.tarifs.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, r.date_tarif ? esc(r.date_tarif) : '<span class="muted">non précisée</span>']))}
<p>Les disponibilités et les tarifs à jour se consultent sur <a href="https://trouverunlogement.lescrous.fr/" rel="noopener">trouverunlogement.lescrous.fr</a>. Les logements Crous ouvrent droit aux aides au logement.</p>
<h2>Loyers privés à ${esc(v.nom)}</h2>
${table(`Indicateur de loyer d'annonce, appartement T1-T2 non meublé, charges comprises, ${V.sources.loyers.millesime}`, [arr ? 'Arrondissement' : 'Commune', 'Loyer par m²', 'Fourchette de prédiction', `Pour ${V.sources.loyers.surface_reference} m²`], v.prive.lignes.map((l) => [esc(l.nom), `${nb(l.m2, 1)} €`, `${nb(l.bas, 1)} à ${nb(l.haut, 1)} €`, eur(Math.round(l.m2 * V.sources.loyers.surface_reference))]), [1, 2, 3])}
${prudence ? '<p class="muted">Pour au moins une ligne, le ministère recommande la prudence : peu d\'annonces observées, ou indicateur calculé sur un groupe de communes voisines.</p>' : ''}
<h2>Pour aller plus loin</h2>
<ul class="grid"><li><a href="/outils/plafond-loyer-apl/"><strong>Loyer plafond APL</strong><span>La part de loyer que la Caf prend en compte.</span></a></li><li><a href="/outils/budget-etudiant/"><strong>Budget mensuel</strong><span>Votre reste à vivre avec ce loyer.</span></a></li><li><a href="/outils/echelon-bourse/"><strong>Échelon de bourse</strong><span>Montant de la bourse ${B.bourse.annee}.</span></a></li></ul>
${sourcesBox(SRC_VILLES, `<p>Données téléchargées le ${dateFr(V.genere_le)}.</p>`)}`,
  });
});

// ---------- pages d'outils et index ----------
TOOLS.forEach((t) => page({ ...t, crumbs: [['/outils/', 'Simulateurs']] }));
const toolCards = `<ul class="grid">${TOOLS.map((t) => `<li><a href="${t.path}"><strong>${esc(t.short)}</strong><span>${esc(t.card)}</span></a></li>`).join('')}</ul>`;
const cityCards = `<ul class="grid">${V.villes.map((v) => { const c = crousResume(v); return `<li><a href="/villes/${v.slug}/"><strong>${esc(v.nom)}</strong><span>${v.residences.length} résidences Crous, dès ${eurA(c.min)} par mois</span></a></li>`; }).join('')}</ul>`;

page({
  path: '/', title: `${CFG.nom} : simulateurs et loyers officiels pour étudiants`,
  description: 'Simulateurs gratuits pour étudiants : échelon de bourse Crous, gratification de stage, frais d\'inscription, budget, loyers Crous et privés par ville. Barèmes officiels cités et datés.',
  h1: 'Calculez votre budget étudiant avec les barèmes officiels',
  body: `<p class="lead">Des calculateurs simples pour les étudiants en France. Chaque formule vient d'un texte officiel, cité et daté sur la page. Chaque résultat est une estimation, avec le lien vers le service qui fait foi.</p>
<h2>Les simulateurs</h2>${toolCards}
<h2>Loyers Crous et privés par ville</h2>
<p>Pour ${V.villes.length} villes étudiantes : les tarifs publiés par les résidences Crous et l'indicateur officiel des loyers privés.</p>${cityCards}
<h2>Pourquoi ce site</h2>
<p>Les aides étudiantes reposent sur des barèmes publics, mais dispersés dans des arrêtés et des circulaires. Ce site les rassemble, sans compte à créer et sans données personnelles : tout est calculé dans votre navigateur. Quand un barème n'est pas vérifiable, l'outil n'est pas publié.</p>`,
});
page({
  path: '/outils/', short: 'Simulateurs', title: `Simulateurs étudiants : bourse, stage, apprentissage, budget | ${CFG.nom}`,
  description: 'Tous les simulateurs pour étudiants : échelon de bourse, gratification de stage, salaire d\'apprenti, frais d\'inscription, aide à la mobilité master, loyer plafond APL, budget.',
  h1: 'Tous les simulateurs', crumbs: [], body: `<p class="lead">Chaque outil indique sa source officielle et la date du barème.</p>${toolCards}<h2>Montants de bourse par échelon</h2><ul class="grid">${B.bourse.echelons.map((e, i) => `<li><a href="/bourse/${echSlug(e)}/"><strong>Échelon ${e}</strong><span>${eur(B.bourse.montants_annuels[i])} par an</span></a></li>`).join('')}</ul>`,
});
page({
  path: '/villes/', short: 'Villes', title: `Loyers étudiants par ville : résidences Crous et loyers privés | ${CFG.nom}`,
  description: `Tarifs des résidences Crous et indicateur officiel des loyers privés dans ${V.villes.length} villes étudiantes françaises.`,
  h1: 'Loyers étudiants par ville', crumbs: [], body: `<p class="lead">Pour chaque ville : les tarifs publiés par les résidences Crous et l'indicateur des loyers privés du ministère du Logement.</p>${cityCards}${LIMITES}${sourcesBox(SRC_VILLES)}`,
});

// ---------- pages d'information ----------
page({
  path: '/sources-et-methode/', short: 'Sources et méthode', title: `Sources et méthode | ${CFG.nom}`,
  description: 'D\'où viennent les barèmes et les données du site, comment ils sont vérifiés et mis à jour, et ce que le site refuse de publier.',
  h1: 'Sources et méthode', crumbs: [],
  body: `<p class="lead">Ces outils touchent au budget de personnes qui n'ont pas de marge d'erreur. Voici les règles que le site s'impose.</p>
<h2>Nos règles</h2>
<ul><li>Chaque formule vient d'une source officielle, citée sur la page avec sa date.</li><li>Chaque résultat est présenté comme une estimation, avec un lien vers le service officiel.</li><li>Les formules sont testées automatiquement sur les exemples chiffrés publiés par l'administration. Si un test échoue, le site n'est pas mis à jour.</li><li>Si un barème n'est pas vérifiable, l'outil n'est pas publié. C'est pourquoi le site ne propose pas d'estimation du montant de l'APL ni de test d'éligibilité à la garantie Visale pour l'instant.</li><li>Aucune page n'existe sans calcul ou sans données qui lui sont propres.</li></ul>
<h2>Sources des barèmes</h2>
${table('', ['Sujet', 'Source', 'Date'], [
    ['Gratification de stage', `<a href="${B.gratification_stage.source.url}">${esc(B.gratification_stage.source.titre)}</a>`, 'Vérifiée par l\'éditeur le ' + dateFr(B.gratification_stage.source.verifie_le)],
    ...B.bourse.sources.map((s) => ['Bourse sur critères sociaux ' + B.bourse.annee, `<a href="${esc(s.url)}">${esc(s.titre)}</a>${s.note ? '<br><span class="muted">' + esc(s.note) + '</span>' : ''}`, s.verifie_le ? 'Vérifiée par l\'éditeur le ' + dateFr(s.verifie_le) : 'Texte de 2026']),
    ['Salaire des apprentis', `<a href="${B.apprenti.source.url}">${esc(B.apprenti.source.titre)}</a>`, 'Vérifiée par l\'éditeur le ' + dateFr(B.apprenti.source.verifie_le)],
    ['Droits d\'inscription et CVEC ' + B.inscription.annee, `<a href="${B.inscription.source.url}">${esc(B.inscription.source.titre)}</a>`, 'Vérifiée par l\'éditeur le ' + dateFr(B.inscription.source.verifie_le)],
    ['Aide à la mobilité en master', `<a href="${B.mobilite_master.source.url}">${esc(B.mobilite_master.source.titre)}</a>`, 'Publiée le ' + dateFr(B.mobilite_master.source.verifie_le)],
    ['Loyers plafonds des aides au logement', `<a href="${B.apl_loyers_plafonds.source.url}">${esc(B.apl_loyers_plafonds.source.titre)}</a>`, 'En vigueur au ' + dateFr(B.apl_loyers_plafonds.date_effet)],
    ['Résidences Crous', `<a href="${V.sources.crous.page}">${esc(V.sources.crous.titre)}</a>`, 'Téléchargé le ' + dateFr(V.genere_le)],
    ['Loyers privés', `<a href="${V.sources.loyers.page}">${esc(V.sources.loyers.titre)}</a><br><span class="muted">${esc(V.sources.loyers.mention)}</span>`, V.sources.loyers.millesime],
  ])}
<p>Les barèmes ont été relus pour la dernière fois le ${dateFr(CFG.baremes_relus_le)}.</p>
<h2>Mises à jour</h2>
<p>Chaque semaine, les pages officielles sont relues. Si un barème a changé, les données et les tests sont mis à jour avant toute publication. En cas de doute sur un chiffre, rien n'est publié.</p>
<h2>Signaler une erreur</h2>
<p>Si vous repérez un chiffre faux ou périmé, signalez-le sur <a href="${CFG.depot}/issues" rel="noopener">la page de suivi du projet</a>. Le code et les données du site sont publics dans le même dépôt.</p>`,
});
page({
  path: '/financement/', short: 'Financement', title: `Comment ce site est financé | ${CFG.nom}`,
  description: 'Publicité et liens affiliés : ce que le site affiche, ce qu\'il refuse, et comment les liens rémunérés sont signalés.',
  h1: 'Comment ce site est financé', crumbs: [],
  body: `<p class="lead">Le site est gratuit et le restera. Il peut être financé par de la publicité et par des liens affiliés, toujours signalés.</p>
<h2>Aujourd'hui</h2>
<p>${CFG.publicite_active || CFG.affiliation_active ? 'Le site affiche de la publicité ou des liens affiliés, signalés comme tels.' : 'Le site n\'affiche aucune publicité et ne contient aucun lien affilié. Il ne rapporte rien à son auteur.'}</p>
<h2>Les règles pour la suite</h2>
<ul><li>Un lien affilié est un lien vers un service (banque, assurance, box internet) qui verse une commission au site si vous y souscrivez. Chaque lien de ce type portera la mention « lien affilié » à côté du lien.</li><li>Une commission ne change jamais un calcul ni un barème.</li><li>Le site ne recommande pas de crédit à la consommation.</li><li>La publicité ne s'affiche avec des cookies que si vous l'acceptez.</li></ul>`,
});
page({
  path: '/mentions-legales/', short: 'Mentions légales', title: `Mentions légales | ${CFG.nom}`,
  description: 'Éditeur, hébergeur et conditions d\'utilisation du site.', h1: 'Mentions légales', crumbs: [],
  body: `<h2>Éditeur</h2><p>${esc(CFG.editeur)}</p><p>Contact : <a href="${CFG.depot}/issues" rel="noopener">page de suivi du projet sur GitHub</a>.</p>
<h2>Hébergeur</h2><p>GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis. Site : <a href="https://pages.github.com/" rel="noopener">pages.github.com</a>.</p>
<h2>Nature des informations</h2><p>${esc(CFG.nom)} est un site indépendant d'information. Il n'est lié ni à l'État, ni à la Caf, ni aux Crous, ni à aucune administration. Les résultats des simulateurs sont des estimations fournies à titre indicatif, sans valeur juridique. Ils ne remplacent ni les simulateurs officiels ni la décision de l'organisme compétent. L'éditeur ne peut être tenu responsable d'une décision prise sur la seule base de ces estimations.</p>
<h2>Données réutilisées</h2><p>Les données des résidences Crous sont réutilisées sous Licence Ouverte 2.0. Les indicateurs de loyers sont réutilisés avec la mention demandée : « ${esc(V.sources.loyers.mention)} ».</p>
<h2>Propriété</h2><p>Le code du site est public sur <a href="${CFG.depot}" rel="noopener">GitHub</a>. Les textes officiels cités restent la propriété de leurs éditeurs.</p>`,
});
page({
  path: '/confidentialite/', short: 'Confidentialité', title: `Confidentialité et cookies | ${CFG.nom}`,
  description: 'Le site ne collecte aucune donnée personnelle : les calculs se font dans votre navigateur. Détail des cookies et de vos droits.',
  h1: 'Confidentialité et cookies', crumbs: [],
  body: `<p class="lead">Le site ne vous demande ni compte, ni nom, ni adresse e-mail. Les montants que vous saisissez ne quittent pas votre navigateur.</p>
<h2>Ce que vous saisissez</h2><p>Les calculs sont faits par un programme exécuté sur votre appareil. Vos revenus, votre loyer et vos réponses ne sont ni envoyés à un serveur, ni enregistrés.</p>
<h2>Cookies</h2><p>${CFG.consentement_requis ? 'Le site utilise des services de publicité ou de mesure d\'audience qui déposent des cookies uniquement si vous l\'acceptez dans le bandeau. Vous pouvez changer d\'avis à tout moment.' : 'Le site ne dépose aucun cookie et n\'utilise aucun traceur. C\'est pourquoi aucun bandeau de consentement ne s\'affiche. Si de la publicité est ajoutée un jour, un bandeau vous demandera votre accord avant tout dépôt de cookie, avec un bouton « Tout refuser » aussi visible que le bouton « Tout accepter ».'}</p>
${CFG.consentement_requis ? '<p><button class="btn" id="consent-reset" type="button">Modifier mon choix</button></p>' : ''}
<h2>Hébergement</h2><p>Le site est hébergé par GitHub Pages. Comme tout hébergeur, GitHub peut enregistrer l'adresse IP des visiteurs dans ses journaux techniques, pour des raisons de sécurité. L'éditeur du site n'a pas accès à ces journaux. Voir la <a href="https://docs.github.com/fr/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">déclaration de confidentialité de GitHub</a>.</p>
${CFG.mesure_audience ? `<h2>Mesure d'audience</h2><p>${esc(CFG.mesure_audience)}</p>` : ''}
<h2>Vos droits</h2><p>Le règlement général sur la protection des données (RGPD) vous donne un droit d'accès, de rectification et d'effacement de vos données. Le site ne conservant aucune donnée personnelle, il n'y a rien à consulter ou à effacer. Pour toute question, utilisez la <a href="${CFG.depot}/issues" rel="noopener">page de suivi du projet</a>. Vous pouvez aussi saisir la <a href="https://www.cnil.fr/" rel="noopener">CNIL</a>.</p>`,
});
page({ path: '/404.html', short: 'Page introuvable', title: `Page introuvable | ${CFG.nom}`, description: 'Cette page n\'existe pas ou a été déplacée. Retrouvez les simulateurs depuis l\'accueil.', h1: 'Page introuvable', noindex: true, crumbs: [], body: `<p>Cette page n'existe pas ou a été déplacée.</p><p><a class="btn" href="/">Retour à l'accueil</a></p>${toolCards}` });

// ---------- écriture ----------
fs.rmSync(DIST, { recursive: true, force: true });
for (const p of pages) {
  const file = p.path.endsWith('.html') ? path.join(DIST, p.path) : path.join(DIST, p.path, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, p.html);
}
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'static/assets'))) fs.copyFileSync(path.join(ROOT, 'static/assets', f), path.join(DIST, 'assets', f));
fs.copyFileSync(path.join(ROOT, 'src/calc.js'), path.join(DIST, 'assets/calc.js'));
fs.copyFileSync(path.join(ROOT, 'src/ui.js'), path.join(DIST, 'assets/ui.js'));
const indexable = pages.filter((p) => !p.noindex);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((p) => `<url><loc>${CFG.url}${p.path}</loc><lastmod>${BUILD_DATE}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${CFG.url}/sitemap.xml\n`);
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
if (CFG.ads_txt) fs.writeFileSync(path.join(DIST, 'ads.txt'), CFG.ads_txt + '\n');
fs.writeFileSync(path.join(DIST, 'pages.json'), JSON.stringify({ genere_le: BUILD_DATE, pages: indexable.map((p) => p.path) }, null, 1) + '\n');
console.log(`${pages.length} pages écrites dans dist/ (${indexable.length} indexables).`);
