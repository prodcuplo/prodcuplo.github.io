'use strict';
// Tests des repères communaux (geo.api.gouv.fr), sans réseau : réponses simulées
// au format de l'API Découpage administratif.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../scripts/update-data.js');

const aix = { code: '13001', nom: 'Aix-en-Provence', codeDepartement: '13', departement: { code: '13', nom: 'Bouches-du-Rhône' }, region: { code: '93', nom: "Provence-Alpes-Côte d'Azur" }, population: 147478, codesPostaux: ['13080', '13090', '13100', '13290', '13540'] };
const smh = { code: '38421', nom: "Saint-Martin-d'Hères", codeDepartement: '38', departement: { code: '38', nom: 'Isère' }, region: { code: '84', nom: 'Auvergne-Rhône-Alpes' }, population: 38000, codesPostaux: ['38400'] };

test('geo : choisit la commune dont le nom et le département correspondent', () => {
  const autre = { ...aix, code: '13999', nom: 'Autre commune' };
  assert.equal(D.pickCommune([autre, aix], 'Aix-en-Provence', '13'), aix);
  assert.equal(D.pickCommune([smh], "St Martin d'Hères", '38'), smh);
});

test('geo : aucune devinette si le nom ou le département diffère', () => {
  assert.equal(D.pickCommune([aix], 'Marseille', '13'), null);
  assert.equal(D.pickCommune([aix], 'Aix-en-Provence', '84'), null);
  assert.equal(D.pickCommune([], 'Aix-en-Provence', '13'), null);
  assert.equal(D.pickCommune(null, 'Aix-en-Provence', '13'), null);
});

test('geo : repères retenus après contrôle', () => {
  assert.deepEqual(D.communeInfo(aix, '13'), {
    insee: '13001', nom: 'Aix-en-Provence', departement: { code: '13', nom: 'Bouches-du-Rhône' },
    region: "Provence-Alpes-Côte d'Azur", population: 147478, codes_postaux: 5,
  });
});

test('geo : repères invraisemblables ou incomplets écartés', () => {
  assert.equal(D.communeInfo(null, '13'), null);
  assert.equal(D.communeInfo({ ...aix, codeDepartement: '84' }, '13'), null);
  assert.equal(D.communeInfo({ ...aix, population: 120 }, '13'), null);
  assert.equal(D.communeInfo({ ...aix, population: '147478' }, '13'), null);
  assert.equal(D.communeInfo({ ...aix, code: 'abc' }, '13'), null);
  assert.equal(D.communeInfo({ ...aix, region: undefined }, '13'), null);
});

test('geo : essaie les codes postaux dans l\'ordre, ignore les cedex sans réponse', () => {
  const asked = [];
  const fetchJson = (url) => {
    asked.push(new URL(url).searchParams.get('codePostal'));
    return url.includes('codePostal=13090') ? [aix] : [];
  };
  assert.equal(D.lookupCommune(['13621', '13090'], 'Aix-en-Provence', '13', fetchJson), aix);
  assert.deepEqual(asked, ['13621', '13090']);
});

test('geo : une erreur réseau remonte (le script reprend alors les anciens repères)', () => {
  const fetchJson = () => { throw new Error('curl: (56) CONNECT tunnel failed'); };
  assert.throws(() => D.lookupCommune(['13090'], 'Aix-en-Provence', '13', fetchJson), /CONNECT/);
});

test('geo : l\'adresse Crous donne bien code postal et commune', () => {
  assert.deepEqual(D.communeFromAddress('565 avenue Gaston Berger 13621 Aix-en-Provence cedex 1'), { cp: '13621', nom: 'Aix-en-Provence' });
  assert.deepEqual(D.communeFromAddress('Rue de Cuques 13090 Aix-en-Provence'), { cp: '13090', nom: 'Aix-en-Provence' });
});
