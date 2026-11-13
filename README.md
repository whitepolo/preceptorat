# Préceptorat

Leçon du jour, révisions espacées, dialogue avec Schopen. Une application pour Sébastien, 30 à 45 minutes.

Adresse, une fois le site publié : <https://whitepolo.github.io/preceptorat/>

Le dépôt est public. Les leçons sont dans le code. Tes réponses et tes notes restent sur l'appareil, puis partent vers GitHub quand tu ouvres un lien déjà rempli et que tu appuies sur Submit.

## Installer sur le téléphone

1. Ouvre l'adresse ci-dessus dans Safari (iPhone) ou Chrome (Android).
2. iPhone : bouton Partager, puis « Sur l'écran d'accueil ».
3. Android : menu du navigateur, puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».
4. Ouvre ensuite Préceptorat depuis l'icône. La leçon du jour et tes brouillons restent lisibles sans réseau après la première visite.

Sur un ordinateur, la même adresse suffit. Le téléphone et l'ordinateur se rejoignent quand Schopen a déposé l'état des révisions dans le dépôt, ou par le fichier JSON des Réglages.

## Envoyer au précepteur

1. Termine la leçon, un message du Dialogue, ou une séance de révisions.
2. Appuie sur « Envoyer au précepteur ». GitHub s'ouvre, titre et texte déjà écrits.
3. Tu es connecté à GitHub sur l'appareil : appuie seulement sur Submit.

S'il n'y a pas de compte GitHub sous la main, Réglages propose « Exporter ma progression » et « Importer ».

## Les six écrans

- **Accueil.** La leçon du jour seulement. Elle est visible dès qu'elle est publiée, à n'importe quelle heure. S'il n'y en a pas encore, l'écran dit qu'elle arrive à partir de 7 h, indique les révisions dues, et propose la dernière leçon s'il y en a une. La leçon se lit étape par étape. La solution reste cachée tant que tu n'as pas écrit, ou choisi « Passer ». « Envoyer au précepteur » ouvre GitHub, déjà rempli. Après À retenir : Pour aller plus loin.
- **Révisions.** Cartes dues, huit au plus, matières mélangées. Tu écris avant de voir la réponse, puis À revoir, Difficile, Correct ou Facile. L'échéancier est FSRS. En fin de séance, le même bouton envoie les notations pas encore déposées.
- **Précepteur.** Le dialogue libre, et les fils des leçons. Schopen répond dans le dépôt, avec une marque invisible en tête de message.
- **Parcours.** La semaine, les modules, les points fragiles, l'assiduité.
- **Bibliothèque.** Leçons passées, vocabulaire, lectures primaires et secondaires.
- **Réglages.** Apparence, rappel de l'envoi, export et import de la progression.

## Pour publier le site

Le déploiement est décrit pour la personne qui tient le dépôt. Deux gestes manuels, une fois :

1. Réglages du dépôt, Pages, source : GitHub Actions.
2. Secrets du dépôt : `PRECEPTEUR_WEBHOOK_URL` et `PRECEPTEUR_WEBHOOK_AUTH` (la valeur exacte de l'en-tête Authorization). S'ils manquent, le réveil de Schopen est ignoré, sans erreur.

Le guide du précepteur est dans `docs/TUTOR.md`. Le format des fichiers est dans `docs/FORMAT.md`.
