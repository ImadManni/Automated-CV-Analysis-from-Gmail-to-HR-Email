# PostgreSQL — Installation et intégration du modèle PCA (step by step)

Tu n’as pas encore PostgreSQL installé. Suis ces étapes dans l’ordre.

---

## Étape 1 — Télécharger PostgreSQL pour Windows

1. Va sur : **https://www.postgresql.org/download/windows/**
2. Clique sur **「Download the installer」** (ou lien vers EDB).
3. Télécharge la **dernière version** (ex. PostgreSQL 16 ou 17) pour **Windows x86-64**.
4. Lance le fichier `.exe` téléchargé.

---

## Étape 2 — Installer PostgreSQL

1. **Welcome** → Next.
2. **Installation directory** → laisse par défaut (ex. `C:\Program Files\PostgreSQL\17`) → Next.
3. **Select components** → coche au minimum :
   - **PostgreSQL Server**
   - **pgAdmin 4** (interface graphique)
   - **Command Line Tools** (pour `psql`)
   → Next.
4. **Data directory** → laisse par défaut → Next.
5. **Password** : choisis un **mot de passe pour l’utilisateur `postgres`** (note-le bien). → Next.
6. **Port** : laisse **5432** → Next.
7. **Locale** → laisse par défaut → Next.
8. **Install** → attendre la fin → Finish (tu peux décocher « Launch Stack Builder »).

---

## Étape 3 — Vérifier que PostgreSQL est installé

1. Ouvre **PowerShell** ou **CMD**.
2. Ajoute le dossier des outils au PATH (remplace `17` par ta version si besoin) :
   ```powershell
   $env:Path += ";C:\Program Files\PostgreSQL\17\bin"
   ```
   Ou ajoute-le définitivement dans **Paramètres Windows → Variables d’environnement → Path**.
3. Teste :
   ```powershell
   psql --version
   ```
   Tu dois voir par exemple : `psql (PostgreSQL) 17.x`.

---

## Étape 4 — Créer la base de données et l’utilisateur PCA

1. Connecte-toi en tant que `postgres` (avec le mot de passe choisi à l’étape 2) :
   ```powershell
   psql -U postgres -h localhost
   ```
2. Dans le prompt `postgres=#`, exécute les commandes suivantes **une par une** :

```sql
-- Créer l’utilisateur (remplace MON_MOT_DE_PASSE par un vrai mot de passe)
CREATE USER pca_user WITH PASSWORD 'MON_MOT_DE_PASSE';

-- Créer la base
CREATE DATABASE pca OWNER pca_user;

-- Donner tous les droits sur la base à pca_user
GRANT ALL PRIVILEGES ON DATABASE pca TO pca_user;

-- Se connecter à la base pca (dans psql, tape \c pca)
\c pca
```

3. Donner les droits sur le schéma `public` (tables à créer) :
```sql
GRANT ALL ON SCHEMA public TO pca_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pca_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pca_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pca_user;
```

4. Quitter psql : `\q`

---

## Étape 5 — Exécuter le script SQL du modèle (créer les tables)

Depuis le **dossier racine du projet** (où se trouve `package.json`) :

```powershell
cd "C:\Users\DELL\Desktop\Automated CV Analysis from Gmail to HR Email"
```

Puis exécute le script avec l’utilisateur `postgres` sur la base `pca` (remplace le chemin si besoin) :

```powershell
psql -U postgres -h localhost -d pca -f server/sql/init-pca.sql
```

Tu seras demandé le mot de passe de l’utilisateur **postgres** (celui de l’étape 2).  
Si tu préfères utiliser `pca_user` :

```powershell
psql -U pca_user -h localhost -d pca -f server/sql/init-pca.sql
```
(utilise alors le mot de passe de `pca_user`.)

Après exécution, tu dois voir des lignes du type : `CREATE TABLE`, `CREATE INDEX`.

---

## Étape 6 — Vérifier que les tables existent

Reconnecte-toi et liste les tables :

```powershell
psql -U pca_user -h localhost -d pca -c "\dt"
```

Tu dois voir : `candidatures` et `users`.

Pour voir la structure d’une table :

```powershell
psql -U pca_user -h localhost -d pca -c "\d candidatures"
```

---

## Étape 7 — (Optionnel) Configurer le projet pour utiliser PostgreSQL

Quand tu voudras brancher l’API Node sur PostgreSQL au lieu des fichiers JSON :

1. Dans le fichier **`.env`** à la racine du projet, ajoute (en adaptant le mot de passe) :
   ```
   DATABASE_URL=postgresql://pca_user:MON_MOT_DE_PASSE@localhost:5432/pca
   ```
2. Installe le client PostgreSQL pour Node :
   ```powershell
   npm install pg
   ```
3. Il faudra ensuite modifier `server/index.js` et `server/auth.js` pour lire/écrire dans PostgreSQL au lieu de `candidatures.json` / `users.json`. On peut le faire dans une prochaine étape.

---

## Récap

| Étape | Action |
|-------|--------|
| 1 | Télécharger l’installer PostgreSQL (Windows) |
| 2 | Installer (mot de passe `postgres`, port 5432) |
| 3 | Vérifier `psql --version` |
| 4 | Créer utilisateur `pca_user` et base `pca` avec `psql -U postgres` |
| 5 | Exécuter `psql -U postgres -d pca -f server/sql/init-pca.sql` |
| 6 | Vérifier avec `\dt` et `\d candidatures` |
| 7 | (Plus tard) Ajouter `DATABASE_URL` et adapter le code serveur |

En cas d’erreur, note le message exact et l’étape pour qu’on puisse corriger.
