# Téléversement de fichiers en Node.js : S3 pour les octets, Postgres pour tout le reste

[English](README.md) | [Français](README.fr.md) | [日本語](README.ja.md) | [Español](README.es.md)

Une application d’exemple Node.js (Express) pour la [plateforme d’apprentissage MitsuruTech](https://mitsurutech.co.uk/fr/learning). Vous téléversez un
fichier ; S3 le conserve ; Postgres retient où il est allé et comment il s’appelle. Le tableau de la
page vient de Postgres, et chaque téléchargement vient de S3.

Elle est volontairement petite, quatre routes et trois fichiers, pour que vous puissiez lire l’ensemble
avant d’en modifier quoi que ce soit.

```
server.js   the web: four routes and nothing else
store.js    the two stores, and the order they are written in
page.js     the HTML
```

## Le déployer ici

Ouvrez **Deploy** sur la plateforme, choisissez ce dépôt, et démarrez une **base de données** et la
**pile cloud** à côté ([comment fonctionne le déploiement depuis GitHub](https://mitsurutech.co.uk/fr/help/deploy-app)). Tout ce dont l’application a besoin se trouve alors déjà dans son environnement ;
il n’y a rien à configurer.

| Variable | Définie par | Ce que c’est |
| --- | --- | --- |
| `DATABASE_URL` | votre session | le serveur Postgres qui tourne sous le nom `db` |
| `AWS_ENDPOINT_URL` | votre session | la pile cloud qui tourne sous le nom `cloud` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | votre session | les identifiants pour y accéder |
| `PORT` | la plateforme | le port sur lequel écouter |
| `BUCKET_NAME` | vous, si vous le souhaitez | `uploads` par défaut |

## Les trois choses à lire

**1. `forcePathStyle: true`, dans `store.js`.** C’est le réglage que tout le monde oublie en premier. Par
défaut, le kit AWS place le bucket dans le nom d’hôte, `uploads.cloud`, et ce nom n’existe pas
sur le réseau de votre session : chaque appel échoue donc avec une erreur DNS qui ne dit rien des
buckets. Le style par chemin demande à la place `http://cloud:4566/uploads/...`.

**2. L’application crée son propre bucket.** Votre pile cloud démarre complètement vide, exactement comme un
vrai compte AWS que vous venez d’ouvrir. `CreateBucket` est le travail de votre code, il s’exécute à chaque
démarrage, et il intercepte « vous en êtes déjà propriétaire » pour qu’un redémarrage ne soit pas un plantage.

**3. Écrire d’abord S3, puis la ligne. Supprimer d’abord la ligne, puis S3.**

- Téléversez les octets, puis insérez la ligne. Si l’insertion échoue, vous avez un objet que personne
  ne référence : invisible, inoffensif, facile à nettoyer.
- Écrivez d’abord la ligne et un téléversement échoué laisse sur la page un fichier impossible à ouvrir,
  sans moyen de distinguer cette ligne d’une bonne.
- La suppression va dans l’autre sens pour la même raison.

L’un de ces échecs, c’est quelques octets perdus. L’autre, c’est une page cassée. Laissez toujours passer en premier
ce qui peut être orphelin sans conséquence.

## Deux habitudes de sécurité, prises au sérieux dans un exemple, volontairement

**La clé S3 est un uuid, jamais le nom du fichier.** Deux personnes téléversent `notes.txt` et l’une ne doit pas
écraser l’autre ; et un nom venu d’un navigateur n’est pas une chose à partir de laquelle construire un chemin :
`../../etc/passwd` est un nom de fichier parfaitement valable pour un formulaire. Le vrai
nom est une colonne, là où il ne risque rien.

**Les téléchargements sont toujours `attachment`, toujours `application/octet-stream`, toujours `nosniff`.**
N’importe qui peut téléverser n’importe quoi. Un fichier HTML servi en ligne s’exécuterait comme une page à l’adresse même de votre application,
avec tout ce que cette page peut atteindre ; enregistré sur le disque, il est inerte.

Et chaque nom de fichier est échappé quand il revient sur la page : un fichier appelé
`<img src=x onerror=alert(1)>` est un nom de fichier tout à fait valable et ne doit pas devenir du balisage.

## L’exécuter sur votre propre machine

Il vous faut un Postgres et quelque chose qui parle S3. Avec Docker :

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev --name pg postgres:16
docker run -d -p 4566:4566 --name cloud localstack/localstack

export DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1

npm ci
npm start
```

Ouvrez ensuite <http://localhost:8080>.

## À essayer ensuite

- Envoyer un gros fichier directement vers S3 au lieu de le garder en mémoire (`store.js` indique
  où).
- Ajouter un compteur de téléchargements, dans DynamoDB : votre pile cloud l’émule aussi.
- Mettre les fichiers derrière une connexion, pour que le tableau soit propre à chaque personne.
- Afficher un aperçu d’image, avec une URL pré-signée plutôt qu’en faisant transiter les octets.

## Licence

Cette œuvre est sous licence [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Vous pouvez la partager et l’adapter pour apprendre et enseigner, à condition de citer Mitsuru Technologies Ltd, de ne pas l’utiliser commercialement et de partager tout ce que vous en tirez sous la même licence. Le texte complet est dans le fichier `LICENSE`.

## À propos

Réalisé par [Mitsuru Technologies](https://mitsurutech.co.uk/fr/learning), qui conçoit la plateforme
d’apprentissage MitsuruTech pour enseigner la programmation. Le même exemple existe dans d’autres langages :
[uploads-java](https://github.com/mitsurutech/uploads-java),
[uploads-python](https://github.com/mitsurutech/uploads-python) et
[uploads-go](https://github.com/mitsurutech/uploads-go).

Vous enseignez à une classe ? Consultez [le prix](https://mitsurutech.co.uk/fr/pricing) ou [créez un compte d’établissement](https://mitsurutech.co.uk/fr/signup).
