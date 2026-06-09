# Réinitialiser le mot de passe postgres (Windows)

Si tu as toujours « authentification par mot de passe échouée », c’est que PostgreSQL n’utilise pas encore **trust** pour localhost. Suis ces étapes **dans l’ordre**.

---

## 1. Trouver le bon dossier data (et donc le bon pg_hba.conf)

PostgreSQL utilise un fichier **pg_hba.conf** qui est dans le **dossier data**. Il faut modifier **ce** fichier.

Dans **PowerShell** :

```powershell
Get-CimInstance Win32_Service | Where-Object { $_.Name -like "*postgres*" } | Select-Object Name, PathName
```

Dans **PathName** tu verras un chemin du type :
`"...\postgresql\17\bin\pg_ctl.exe" runservice -N "postgresql-x64-17" -D "C:\Program Files\PostgreSQL\17\data"`
Le **-D "..."** indique le **dossier data**. C’est là qu’il y a **pg_hba.conf**.

Exemple : si `-D "C:\Program Files\PostgreSQL\17\data"`, alors le fichier à modifier est :
**`C:\Program Files\PostgreSQL\17\data\pg_hba.conf`**

Note ce chemin et utilise-le à l’étape 3.

---

## 2. Arrêter le service PostgreSQL

- **Win + R** → `services.msc` → Entrée  
- Cherche **PostgreSQL** (ex. **postgresql-x64-17**)  
- Clic droit → **Arrêter**

---

## 3. Modifier pg_hba.conf (avec le chemin trouvé à l’étape 1)

1. Ouvre **Bloc-notes en administrateur** :
   - Menu Démarrer → tape **notepad**
   - Clic droit sur **Bloc-notes** → **Exécuter en tant qu’administrateur**

2. Dans le Bloc-notes : **Fichier → Ouvrir**. Va dans le **dossier data** (ex. `C:\Program Files\PostgreSQL\17\data`).

3. En bas à droite : **« Fichiers texte (*.txt) »** → choisis **« Tous les fichiers (*.*) »**.

4. Ouvre **pg_hba.conf**.

5. Trouve la section qui contient des lignes comme :
   ```
   host    all    all    127.0.0.1/32    scram-sha-256
   host    all    all    ::1/128         scram-sha-256
   ```

6. **En tout début de cette section** (juste après le commentaire « IPv4 local » / « IPv6 local »), **ajoute** ces deux lignes **avant** toutes les autres lignes `host` :
   ```
   host    all             all             127.0.0.1/32            trust
   host    all             all             ::1/128                 trust
   ```
   (Copie-colle exactement, avec des tabulations entre les colonnes si besoin.)

   L’ordre dans pg_hba.conf est important : **la première règle qui correspond est utilisée**. En mettant **trust** en premier, PostgreSQL acceptera la connexion sans mot de passe.

7. Tu peux laisser les anciennes lignes (scram-sha-256) en dessous ; pas besoin de les supprimer.

8. **Enregistre** (Ctrl+S) et ferme le Bloc-notes.

---

## 4. Redémarrer le service PostgreSQL

- **services.msc** → **PostgreSQL** → Clic droit → **Démarrer**

---

## 5. Tester : plus de demande de mot de passe

Dans PowerShell :

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -c "ALTER USER postgres PASSWORD 'Postgres2026';"
```

Si **trust** est bien pris en compte :
- Il **ne doit pas** te demander « Mot de passe pour l’utilisateur postgres ».
- Tu dois voir : **ALTER ROLE**.

Si tu vois encore la demande de mot de passe ou « authentification échouée », alors le fichier modifié n’est pas le bon (revérifier le **-D** à l’étape 1) ou le service n’a pas été redémarré.

---

## 6. Remettre la sécurité (après avoir vu ALTER ROLE)

1. Rouvre **pg_hba.conf** (toujours en admin).
2. **Supprime** les deux lignes **trust** que tu as ajoutées (les deux avec `127.0.0.1/32` et `::1/128` et `trust`).
3. Sauvegarde.
4. **services.msc** → PostgreSQL → **Redémarrer**.

Désormais, la connexion avec **postgres** demandera à nouveau le mot de passe (celui que tu as mis : **Postgres2026**).

---

## 7. Créer la base PCA

```powershell
cd "C:\Users\DELL\Desktop\Automated CV Analysis from Gmail to HR Email"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -f server/sql/create-db-kamla.sql
```

Quand il demande le mot de passe : **Postgres2026** (ou celui que tu as choisi).
