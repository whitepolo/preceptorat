# Préceptorat

Leçon du soir, révisions espacées, dialogue avec Schopen. Une application pour Sébastien, 30 à 45 minutes.

Adresse, une fois le site publié : <https://whitepolo.github.io/preceptorat/>

Le dépôt est public. Les leçons sont dans le code. Tes réponses et tes notes de révision partent vers GitHub seulement si tu colles un jeton. Ce jeton reste dans le navigateur.

## Installer sur le téléphone

1. Ouvre l'adresse ci-dessus dans Safari (iPhone) ou Chrome (Android).
2. iPhone : bouton Partager, puis « Sur l'écran d'accueil ».
3. Android : menu du navigateur, puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».
4. Ouvre ensuite Préceptorat depuis l'icône. La leçon du soir reste lisible sans réseau après la première visite. L'envoi des réponses et la synchronisation demandent le réseau.

Sur un ordinateur, la même adresse suffit. Le téléphone et l'ordinateur se rejoignent par le fichier de révisions du dépôt, dès que le jeton est en place des deux côtés.

## Le jeton, une fois par appareil

La page de GitHub est en anglais. Les mots entre guillemets sont les libellés exacts.

1. Ouvre <https://github.com/settings/personal-access-tokens/new>.
2. « Token name » : Préceptorat.
3. « Expiration » : choisis une durée.
4. « Repository access » : « Only select repositories », puis sélectionne « preceptorat ».
5. « Permissions » : « Add permissions », puis « Repository permissions ».
6. Pour « Issues », choisis « Read and write ». Le menu affiche d'abord « No access » ou « Read-only ».
7. Pour « Contents », choisis aussi « Read and write ».
8. « Metadata » passe tout seul à « Read-only ». C'est normal.
9. « Generate token ». Copie le jeton, colle-le dans Réglages, puis « Tester ».

Sans jeton, tu peux lire. Tu ne peux pas envoyer une réponse ni synchroniser les cartes.

## Les six écrans

- **Accueil.** La leçon du jour seulement. S'il n'y en a pas encore, l'écran dit qu'elle arrive vers 19 h, indique les révisions dues, et propose la dernière leçon s'il y en a une. La leçon se lit étape par étape. La solution reste cachée tant que tu n'as pas écrit, ou choisi « Passer ». « Envoyer mes réponses au précepteur » poste un seul commentaire. Après À retenir : Pour aller plus loin.
- **Révisions.** Cartes dues, huit au plus, matières mélangées. Tu écris avant de voir la réponse, puis À revoir, Difficile, Correct ou Facile. L'échéancier est FSRS.
- **Précepteur.** Le dialogue libre, et un fil par leçon. Schopen répond dans le même compte, avec une marque invisible en tête de message.
- **Parcours.** La semaine, les modules, les points fragiles, l'assiduité.
- **Bibliothèque.** Leçons passées, vocabulaire, lectures primaires et secondaires.
- **Réglages.** Jeton, thème clair ou sombre, essai de connexion.

## Pour publier le site

Le déploiement est décrit pour la personne qui tient le dépôt. Deux gestes manuels, une fois :

1. Réglages du dépôt, Pages, source : GitHub Actions.
2. Secrets du dépôt : `PRECEPTEUR_WEBHOOK_URL` et `PRECEPTEUR_WEBHOOK_AUTH` (la valeur exacte de l'en-tête Authorization). S'ils manquent, le réveil de Schopen est ignoré, sans erreur.

Le guide du précepteur est dans `docs/TUTOR.md`. Le format des fichiers est dans `docs/FORMAT.md`.
