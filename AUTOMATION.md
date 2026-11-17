# Procédure de la mise à jour hebdomadaire

Cette procédure est suivie chaque semaine par une tâche planifiée, sans intervention humaine.
Règle absolue : **en cas d'échec, de doute ou d'ambiguïté, ne rien publier.** Mieux vaut une semaine sans changement qu'un chiffre faux.

## 0. Préparation

1. Cloner `prodcuplo/prodcuplo.github.io`, branche `main`.
2. Lancer `npm test && npm run build && npm run check`. Si l'une échoue avant tout changement, s'arrêter : noter le problème dans `journal/AAAA-MM.md` sur une branche séparée, ne pas toucher à `main`.

## 1. Santé du site

1. Ouvrir https://prodcuplo.github.io/ et trois pages au hasard listées dans `/pages.json`. Vérifier le code 200 et la présence du titre.
2. Ouvrir une page d'outil dans un vrai navigateur (Playwright), remplir le formulaire, vérifier qu'un résultat s'affiche et qu'il n'y a aucune erreur JavaScript.
3. Lancer `npm run links`. Un lien mort (404 ou 410) vers une source officielle doit être remplacé par la nouvelle adresse officielle, trouvée sur le site de l'éditeur. Si elle est introuvable, noter le problème dans le journal et ne pas inventer d'adresse.

## 2. Barèmes

Pour chaque entrée de `data/baremes.json` :

1. Ouvrir l'URL de la source et relire les chiffres.
2. Si rien n'a changé : ne rien faire, sauf mettre à jour `baremes_relus_le` dans `data/site.json`.
3. Si un chiffre a changé et que le nouveau texte est clair et daté : mettre à jour le barème, la date `verifie_le`, et les tests (`tests/calc.test.js`) avec les nouveaux exemples officiels. Les tests doivent passer.
4. Si le texte est ambigu, contradictoire entre deux sources officielles, ou pas encore en vigueur : ne rien changer, le noter dans le journal.

Dates à surveiller : bourses (arrêtés au printemps, nouvelle année universitaire en septembre), aides au logement (1er octobre), Smic et gratification de stage (1er janvier), droits d'inscription et CVEC (été).

Ne jamais utiliser un site non officiel comme seule source d'un chiffre.

## 3. Données par ville

1. Lancer `npm run data`. Le script s'arrête sans rien écrire si les données paraissent anormales.
   - Si les sites publics sont injoignables depuis l'environnement (erreur réseau ou proxy), passer par GitHub : `gh workflow run donnees.yml --ref main`, attendre la fin (`gh run list --workflow donnees.yml`, puis `gh run watch <id>`), puis récupérer le fichier produit : `git fetch origin donnees/villes && git checkout FETCH_HEAD -- data/villes.json`. Ne jamais travailler sur la branche `donnees/villes` : le workflow l'écrase. Si le workflow échoue, ne rien changer et le noter dans le journal.
   - Les repères communaux (geo.api.gouv.fr) sont facultatifs : si l'API ne répond pas, le script reprend ceux de la semaine précédente et le signale dans sa sortie.
2. Relire le diff de `data/villes.json`. Un changement massif (plus de 20 % des lignes) ou des montants invraisemblables : annuler (`git checkout data/villes.json`) et le noter dans le journal.

## 4. Nouvelles pages (2 à 3 par semaine au plus)

Une page n'est ajoutée que si elle contient un calcul ou des données qui lui sont propres et vérifiables. Sinon, n'en ajouter aucune cette semaine.

Pistes, par ordre de préférence :

1. Un nouvel outil avec un barème officiel simple (exemples : aide au mérite, bourse outre-mer, exonérations, prêt étudiant garanti par l'État, tarifs des repas Crous). Ajouter le barème dans `data/baremes.json` avec sa source et ses dates, la formule dans `src/calc.js`, au moins un test tiré d'un exemple officiel, la page dans `scripts/build.js`.
2. Une page de situation dont le calcul diffère vraiment (exemple : gratification de stage pour une durée donnée avec le calendrier réel).
3. De nouvelles villes si les données Crous le permettent.

Interdits : pages au contenu dupliqué où seul un nom change, texte de remplissage, chiffres sans source, conseils financiers personnalisés, promotion de crédit.

Les outils listés dans le README comme « volontairement non publiés » ne peuvent être publiés que si la formule complète a été lue dans le texte officiel et testée sur des cas types officiels.

## 5. Publication

1. `npm test && npm run build && npm run check` doivent passer.
2. Relire le diff complet. Chaque chiffre nouveau doit avoir sa source dans le diff.
3. Commit sur `main` avec un message clair en français, puis `git push`. Le déploiement est automatique.
4. Attendre la fin du déploiement, puis rouvrir les pages modifiées en ligne pour vérifier.
5. Ajouter une entrée datée dans `journal/AAAA-MM.md` : ce qui a été vérifié, changé, ajouté, et les problèmes en attente. Ce journal sert au mail mensuel.

## Limites

- Ne jamais dépenser d'argent, créer de compte, ni signer quoi que ce soit.
- Ne jamais modifier `data/site.json` pour activer la publicité ou l'affiliation : cela dépend d'inscriptions faites par le propriétaire.
- Ne jamais désactiver ou supprimer un test pour faire passer la publication.
