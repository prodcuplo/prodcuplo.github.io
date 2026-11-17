// Branche les formulaires sur les formules de calc.js. Aucun envoi réseau :
// tout ce que l'utilisateur saisit reste dans son navigateur.
(function () {
  'use strict';
  var C = window.Calc;
  var dataEl = document.getElementById('page-data');
  var D = dataEl ? JSON.parse(dataEl.textContent) : {};
  var tool = document.body.getAttribute('data-tool');
  var $ = function (id) { return document.getElementById(id); };
  var eur = function (v, dec) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec === 0 ? 0 : 2, maximumFractionDigits: dec === 0 ? 0 : 2 }).format(v);
  };
  var num = function (id) {
    var v = $(id).value.replace(/\s/g, '').replace(',', '.');
    if (v === '') return NaN;
    return Number(v);
  };
  var numOr0 = function (id) { var v = num(id); return isNaN(v) ? 0 : v; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var show = function (html) { var r = $('result'); r.innerHTML = html; r.hidden = false; };
  var err = function (msg) { show('<p class="bad"><strong>' + esc(msg) + '</strong></p>'); };
  var ESTIM = '<p class="muted">Estimation indicative, sans valeur officielle. Vérifiez votre situation avec le service officiel indiqué plus bas.</p>';

  function onSubmit(fn) {
    var f = $('calc');
    if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      try { fn(); } catch (ex) { err('Vérifiez les valeurs saisies : ' + ex.message + '.'); }
    });
  }

  var tools = {
    stage: function () {
      onSubmit(function () {
        var jours = num('jours'), hj = num('heures_jour'), h = num('heures');
        var heures = !isNaN(h) ? h : jours * hj;
        if (isNaN(heures)) return err('Indiquez un nombre total d\'heures, ou un nombre de jours et d\'heures par jour.');
        var taux = num('taux');
        var mois = num('mois');
        var r = C.gratificationStage(D.b, heures, isNaN(taux) ? undefined : taux);
        var html;
        if (r.obligatoire) {
          html = '<p>Gratification minimale pour ' + heures.toLocaleString('fr-FR') + ' heures de présence</p><span class="big">' + eur(r.total) + '</span>' +
            '<p>Soit ' + heures.toLocaleString('fr-FR') + ' h × ' + eur(r.taux) + ' par heure.' +
            (!isNaN(mois) && mois > 0 ? ' Lissée sur ' + mois + ' mois : <strong>' + eur(C.round2(r.total / mois)) + ' par mois</strong>.' : '') + '</p>';
        } else {
          html = '<p>Gratification obligatoire</p><span class="big">Non obligatoire</span>' +
            '<p>Avec ' + heures.toLocaleString('fr-FR') + ' heures, le stage ne dépasse pas le seuil de ' + D.b.seuil_heures + ' heures : l\'organisme d\'accueil n\'est pas obligé de verser une gratification. S\'il en verse une au taux minimum, elle serait de ' + eur(r.total_si_versee) + '.</p>';
        }
        show(html + ESTIM);
      });
    },

    bourse: function () {
      onSubmit(function () {
        var revenu = num('revenu');
        if (isNaN(revenu)) return err('Indiquez le revenu brut global de l\'avis fiscal.');
        var points = C.pointsCharge(D.b, {
          distance_km: numOr0('distance'),
          autres_enfants: Math.round(numOr0('enfants')),
          autres_enfants_superieur: Math.round(numOr0('enfants_sup')),
          handicap: $('handicap').checked,
          aidant: $('aidant').checked,
        });
        var r = C.echelonBourse(D.b, revenu, points);
        var html;
        if (r.eligible) {
          html = '<p>Échelon estimé pour ' + D.b.annee + '</p><span class="big">Échelon ' + esc(r.echelon) + '</span>' +
            '<p><strong>' + eur(r.annuel, 0) + ' par an</strong>, soit environ ' + eur(r.mensuel) + ' par mois sur ' + D.b.nb_mensualites + ' mois.</p>' +
            '<p>Vous avez ' + points + ' point' + (points > 1 ? 's' : '') + ' de charge. Avec ce nombre de points, le plafond de l\'échelon ' + esc(r.echelon) + ' est de ' + eur(r.plafond, 0) + '. <a href="/bourse/echelon-' + esc(r.echelon.replace(' ', '-')) + '/">Détail de l\'échelon ' + esc(r.echelon) + '</a></p>';
        } else {
          html = '<p>Échelon estimé pour ' + D.b.annee + '</p><span class="big">Pas de bourse d\'après ce barème</span>' +
            '<p>Avec ' + points + ' point' + (points > 1 ? 's' : '') + ' de charge, le revenu maximum pour l\'échelon 0 bis est de ' + eur(r.plafond_max, 0) + '. D\'autres aides existent : parlez-en au service social de votre Crous.</p>';
        }
        if (r.hors_bareme) html += '<p class="muted">Le barème publié s\'arrête à 17 points de charge : le calcul utilise la ligne 17 points.</p>';
        show(html + ESTIM);
      });
    },

    apprenti: function () {
      onSubmit(function () {
        var age = num('age');
        if (isNaN(age)) return err('Indiquez votre âge.');
        var annee = Number($('annee').value);
        var r = C.salaireApprenti(D.b, age, annee);
        show('<p>Salaire minimum légal, ' + annee + (annee === 1 ? 're' : 'e') + ' année de contrat, ' + esc(D.b.tranches_age[r.tranche]) + '</p>' +
          '<span class="big">' + eur(r.brut_mensuel) + ' brut par mois</span>' +
          '<p>Soit ' + r.pourcentage + ' % du Smic (' + eur(D.b.smic_mensuel_brut) + ' brut par mois pour 35 heures).' +
          (r.tranche >= 2 ? ' À partir de 21 ans, on retient le montant le plus élevé entre ce pourcentage du Smic et le même pourcentage du salaire minimum conventionnel de l\'emploi occupé.' : '') +
          ' Un accord collectif peut prévoir davantage.</p>' + ESTIM);
      });
    },

    inscription: function () {
      onSubmit(function () {
        var r = C.fraisInscription(D.b, $('formation').value, $('boursier').checked, $('reduit').checked ? 'reduit' : 'normal');
        show('<p>À payer pour l\'année ' + D.b.annee + '</p><span class="big">' + eur(r.total, 0) + '</span>' +
          '<p>Droits d\'inscription : ' + eur(r.droits, 0) + '. CVEC : ' + eur(r.cvec, 0) + '.' +
          ($('boursier').checked ? ' Les boursiers sur critères sociaux sont exonérés des droits d\'inscription et de la CVEC.' : '') + '</p>' + ESTIM);
      });
    },

    mobilite: function () {
      onSubmit(function () {
        var r = C.mobiliteMaster(D.b, {
          boursier: $('c1').checked, licence_nationale: $('c2').checked,
          m1_annee_suivante: $('c3').checked, change_region: $('c4').checked,
        });
        if (r.eligible) {
          show('<p>D\'après les quatre conditions cochées</p><span class="big good">Vous remplissez les conditions</span><p>Le montant de l\'aide est de <strong>' + eur(r.montant, 0) + '</strong>, versé en une fois.</p>' + ESTIM);
        } else {
          show('<p>D\'après les conditions cochées</p><span class="big">Conditions non remplies</span><p>Il manque :</p><ul>' +
            r.manque.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' + ESTIM);
        }
      });
    },

    apl: function () {
      onSubmit(function () {
        var loyer = num('loyer');
        if (isNaN(loyer)) return err('Indiquez votre loyer mensuel hors charges.');
        var r = C.loyerPlafondApl(D.b, Number($('zone').value), Number($('compo').value), $('coloc').checked, loyer);
        show('<p>Loyer pris en compte par la Caf dans le calcul</p><span class="big">' + eur(r.retenu) + ' sur ' + eur(loyer) + '</span>' +
          '<p>Le loyer plafond de votre situation est de <strong>' + eur(r.plafond) + '</strong> par mois. ' +
          (r.au_dessus > 0 ? 'Les ' + eur(r.au_dessus) + ' au-dessus du plafond ne comptent pas : un loyer plus élevé n\'augmente pas l\'aide.' : 'Votre loyer est sous le plafond : il est pris en compte en entier.') + '</p>' +
          '<p class="muted">Ce n\'est pas le montant de votre aide. Le montant dépend aussi de vos ressources et de votre situation : seul le simulateur de la Caf le calcule.</p>');
      });
    },

    budget: function () {
      var f = $('calc');
      var compute = function () {
        var rev = {}, dep = {};
        f.querySelectorAll('input[data-k]').forEach(function (i) {
          var v = Number(i.value.replace(',', '.'));
          if (i.value !== '' && (isNaN(v) || v < 0)) throw new RangeError('montant invalide dans « ' + i.getAttribute('data-label') + ' »');
          (i.getAttribute('data-t') === 'r' ? rev : dep)[i.getAttribute('data-k')] = i.value === '' ? 0 : v;
        });
        var annuels = numOr0('annuels');
        if (annuels < 0) throw new RangeError('frais annuels invalides');
        dep.annuels = C.round2(annuels / 12);
        var r = C.budget(rev, dep);
        var cls = r.reste >= 0 ? 'good' : 'bad';
        show('<p>Reste à vivre chaque mois</p><span class="big ' + cls + '">' + eur(r.reste) + '</span>' +
          '<p>Revenus : ' + eur(r.revenus) + '. Dépenses : ' + eur(r.depenses) + (annuels ? ' (dont ' + eur(dep.annuels) + ' par mois pour les frais annuels)' : '') + '.' +
          (r.part_logement !== null && dep.loyer > 0 ? ' Le loyer représente ' + r.part_logement.toLocaleString('fr-FR') + ' % de vos revenus.' : '') + '</p>' +
          (r.reste < 0 ? '<p>Votre budget est en déficit. Le service social de votre Crous peut étudier une aide ponctuelle ou annuelle : <a href="https://www.etudiant.gouv.fr/">etudiant.gouv.fr</a>.</p>' : ''));
      };
      onSubmit(compute);
    },

    compare: function () {
      var sel = $('ville'), arr = $('arr'), arrField = $('arr-field');
      var villes = D.villes;
      var current = function () { return villes[sel ? sel.selectedIndex : 0]; };
      var fillArr = function () {
        var v = current();
        arr.innerHTML = v.l.map(function (l, i) { return '<option value="' + i + '">' + esc(l.n) + '</option>'; }).join('');
        arrField.hidden = v.l.length < 2;
        if ($('crous') && !$('crous').dataset.touched) $('crous').value = v.min;
      };
      if (sel) sel.addEventListener('change', fillArr);
      if ($('crous')) $('crous').addEventListener('input', function () { this.dataset.touched = '1'; });
      fillArr();
      onSubmit(function () {
        var v = current(), l = v.l[Number(arr.value) || 0];
        var surface = num('surface'), crous = num('crous');
        if (isNaN(surface) || isNaN(crous)) return err('Indiquez une surface et un loyer Crous.');
        if (crous < 0) return err('Le loyer Crous ne peut pas être négatif.');
        var prive = C.loyerPrive(l.m, surface);
        var diff = Math.round(prive - crous);
        show('<p>Loyer privé indicatif à ' + esc(l.n) + ' pour ' + surface + ' m², charges comprises</p><span class="big">environ ' + eur(prive, 0) + ' par mois</span>' +
          '<p>' + (diff > 0 ? 'C\'est environ <strong>' + eur(diff, 0) + ' de plus par mois</strong> que le loyer Crous saisi (' + eur(crous) + '), soit ' + eur(diff * 12, 0) + ' sur 12 mois.' :
            'C\'est environ ' + eur(-diff, 0) + ' de moins par mois que le loyer Crous saisi (' + eur(crous) + ').') + '</p>' +
          '<p class="muted">Calcul : ' + l.m.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' €/m² × ' + surface + ' m². L\'indicateur officiel est établi pour un T1-T2 non meublé de 37 m² : le prix au m² d\'un petit studio est souvent plus élevé, et celui d\'un meublé aussi. Les aides au logement ne sont pas déduites.</p>');
      });
    },
  };

  if (tool && tools[tool]) tools[tool]();

  // Bandeau de consentement : n'apparaît que si le site charge un service
  // soumis à consentement (publicité, mesure d'audience avec cookies).
  var services = document.body.getAttribute('data-consent');
  if (services) {
    var KEY = 'consentement-v1';
    var choice = null;
    try { choice = localStorage.getItem(KEY); } catch (e) { /* stockage indisponible */ }
    var load = function () {
      document.querySelectorAll('script[type="text/plain"][data-consent-src]').forEach(function (s) {
        var n = document.createElement('script');
        n.src = s.getAttribute('data-consent-src'); n.async = true;
        if (s.getAttribute('data-crossorigin')) n.crossOrigin = s.getAttribute('data-crossorigin');
        document.head.appendChild(n);
      });
    };
    if (choice === 'oui') load();
    if (!choice) {
      var b = document.createElement('div');
      b.id = 'consent'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Cookies');
      b.innerHTML = '<div class="wrap"><p>Ce site affiche de la publicité pour financer son hébergement. Avec votre accord, nos partenaires déposent des cookies pour personnaliser les annonces. Vous pouvez refuser : le site fonctionne de la même façon. <a href="/confidentialite/">En savoir plus</a></p><button class="btn ghost" id="c-non">Tout refuser</button><button class="btn" id="c-oui">Tout accepter</button></div>';
      document.body.appendChild(b);
      var set = function (v) { try { localStorage.setItem(KEY, v); } catch (e) { /* rien */ } b.remove(); if (v === 'oui') load(); };
      document.getElementById('c-non').addEventListener('click', function () { set('non'); });
      document.getElementById('c-oui').addEventListener('click', function () { set('oui'); });
    }
  }
  var reset = document.getElementById('consent-reset');
  if (reset) reset.addEventListener('click', function () { try { localStorage.removeItem('consentement-v1'); } catch (e) { /* rien */ } location.reload(); });
})();
