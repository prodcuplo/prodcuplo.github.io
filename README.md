# Budget Campus

Site statique de simulateurs et de données officielles pour le budget des étudiants en France.
En ligne : https://prodcuplo.github.io

## Principes

1. **Exactitude avant tout.** Chaque formule vient d'une source officielle, citée sur la page avec sa date. Chaque résultat est une estimation, avec un lien vers le service officiel. Sans barème vérifiable, l'outil n'est pas publié.
2. **Pas de pages creuses.** Une page n'existe que si elle contient un calcul ou des données qui lui sont propres.
3. **Honnêteté.** Liens affiliés signalés, mentions légales, aucune donnée personnelle collectée.
4. **Automatisation.** Le site se met à jour seul chaque semaine (voir `AUTOMATION.md`). En cas de doute, rien n'est publié.

## Structure

| Chemin | Rôle |
| --- | --- |
| `data/baremes.json` | Tous les barèmes, avec source, URL et dates. Aucun chiffre officiel n'est écrit ailleurs. |
| `data/villes.json` | Résidences Crous, loyers privés et repères communaux (code Insee, département, région, population) par ville, produit par `scripts/update-data.js`. |
| `data/site.json` | Réglages du site : nom, URL, publicité, consentement, vérification Google. |
| `src/calc.js` | Formules pures, partagées par le navigateur et les tests. |
| `src/ui.js` | Branche les formulaires. Aucun envoi réseau. |
| `scripts/build.js` | Génère `dist/` (pages, sitemap, robots.txt). Aucune dépendance. |
| `scripts/check-dist.js` | Contrôle le site généré : liens internes, titres, contenu, JSON. |
| `scripts/check-links.js` | Vérifie les liens externes. |
| `tests/calc.test.js` | Tests des formules sur les exemples chiffrés officiels. |
| `tests/geo.test.js` | Tests des repères communaux, sur des réponses simulées de geo.api.gouv.fr. |
| `.github/workflows/deploy.yml` | Tests, génération, contrôle, puis déploiement sur GitHub Pages. |
| `.github/workflows/donnees.yml` | Lance `npm run data` sur un serveur GitHub et fournit `villes.json` en artefact, sans rien publier. |

## Commandes

```
npm test          # tests des formules
npm run build     # génère dist/
npm run check     # contrôle dist/
npm run links     # vérifie les liens externes
npm run data      # retélécharge les données Crous, loyers et repères communaux
```

Node 20 ou plus. Aucune dépendance à installer.

## Outils publiés

| Outil | Source | Testé sur |
| --- | --- | --- |
| Gratification de stage | service-public F32131 | Exemple officiel 441 h = 1 984,50 € |
| Échelon de bourse 2026-2027 | Arrêté du 26 mars 2026, circulaire du 13 février 2026, service-public F12214 | Cohérence du barème, bornes de chaque échelon |
| Salaire d'un apprenti | service-public F2918 | Les 9 montants publiés |
| Frais d'inscription et CVEC | service-public F2865 | Montants publiés |
| Aide à la mobilité master | etudiant.gouv.fr | Les 4 conditions |
| Loyer plafond APL | Barème Caf au 1er octobre 2026 | Valeurs publiées, rapport colocation |
| Budget mensuel | Aucune (additions) | Additions |
| Crous ou privé, 30 pages ville | Données ouvertes Crous, carte des loyers du ministère | Contrôles de vraisemblance |

## Outils volontairement non publiés

- **Estimation du montant de l'APL.** La formule complète a de nombreux paramètres (participation personnelle, ressources forfaitaires des étudiants) que nous n'avons pas pu lire dans le texte officiel ni tester sur des cas types. Seuls les loyers plafonds, publiés par la Caf, sont en ligne.
- **Éligibilité Visale.** La fiche officielle distingue plusieurs zones hors Île-de-France avec des seuils différents, sans que la liste des communes soit claire. Trop ambigu pour être publié.
- **Prime d'activité, coût des transports par ville.** Pas de barème simple et fiable pour l'instant.

## Choix faits et pourquoi

- **Nom « Budget Campus ».** Court, descriptif, sans marque déposée évidente. Modifiable dans `data/site.json`.
- **Adresse `prodcuplo.github.io`.** Gratuite. Limite connue : Google AdSense accepte mal les sous-domaines gratuits, et un changement de domaine plus tard fera perdre une partie du référencement.
- **Générateur maison plutôt qu'Eleventy.** 400 lignes de Node, zéro dépendance : rien à mettre à jour, rien qui casse seul.
- **Pas de cookies, pas de traceur.** Donc pas de bandeau aujourd'hui. Le bandeau de consentement est déjà codé (`src/ui.js`) et s'active avec `consentement_requis: true` le jour où de la publicité est ajoutée.
- **Tarifs Crous recopiés mot pour mot.** Les fiches des Crous sont du texte libre. Plutôt que d'interpréter, le site cite les lignes de tarif telles quelles, et n'en tire qu'un minimum et un maximum.
- **Loyers privés : indicateur du ministère, pas de moyenne maison.** L'indicateur vaut pour un T1-T2 non meublé de 37 m². La page le dit et signale que les petits studios coûtent souvent plus au m².
- **Plafonds de bourse.** Légifrance bloque la lecture automatique. Le tableau a été recopié depuis deux reproductions concordantes de l'arrêté (CIDJ et Previssima), et les montants ont été vérifiés sur service-public. C'est indiqué sur la page.
- **Smic des apprentis.** Les montants officiels se retrouvent exactement avec 12,31 € x 35 x 52 / 12, non arrondi. Le test vérifie les 9 montants.
- **Villes.** Une ville a sa page si au moins 3 de ses résidences Crous publient leurs tarifs et si la commune figure dans la carte des loyers. Montpellier, Toulouse, Rennes, Bordeaux et Lille n'y sont pas : leurs fiches ne donnent pas de tarifs.
- **Mentions légales.** Le site est édité à titre personnel et non professionnel. Dès qu'il y aura des revenus (micro-entreprise), il faudra y ajouter l'identité et le SIRET de l'éditeur.

## Licence des données

- Résidences Crous : Licence Ouverte 2.0.
- Loyers : « Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin ».
- Repères communaux : API Découpage administratif (geo.api.gouv.fr), données ouvertes de l'Insee. Facultatifs : sans réponse de l'API, le script garde ceux de la version précédente.
