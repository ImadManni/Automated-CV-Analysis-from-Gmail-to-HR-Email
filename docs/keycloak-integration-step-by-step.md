# Keycloak — Intégration pas à pas (jusqu’à voir l’utilisateur côté front)

Ce guide utilise les valeurs de ton `.env.pca` : realm **pca-app**, clients **pca-web** (front) et **pca-service** (backend).

---

## Prérequis

- **Java 17** (ou 21) : `java -version`
- **Node.js** pour lancer l’app PCA (front + API)

---

## Étape 1 — Démarrer Keycloak

### Option A : Script du projet (sans Docker)

1. **Télécharger Keycloak**  
   - https://www.keycloak.org/downloads  
   - Choisir **Keycloak 24** ou **26** → **ZIP**

2. **Extraire** le ZIP. Tu obtiens un dossier du type `keycloak-24.0.x` ou `keycloak-26.5.4`.

3. **Placer** ce dossier :
   - soit à la **racine du projet PCA** (à côté de `package.json`),
   - soit sur le **Bureau**.

4. **Lancer Keycloak** :
   - Depuis la racine du projet :  
     `.\scripts\start-keycloak.ps1`  
     ou  
     `scripts\start-keycloak.bat`
   - Ou depuis le dossier Keycloak :  
     `.\bin\kc.bat start-dev`

5. **Premier démarrage** : Keycloak propose de créer un **utilisateur admin** (ex. `admin` / `admin`). À faire une seule fois.

6. **Vérifier** : ouvrir **http://localhost:8080** → Admin Console → se connecter avec l’admin.

**Important** : Ton `.env.pca` a `KEYCLOAK_URL=http://localhost:8080`. Si tu lances aussi le backend Spring (Gateway) sur 8080, il y aura conflit. Dans ce cas, soit tu arrêtes Spring pendant les tests Keycloak, soit tu lances Keycloak sur un autre port, par exemple :
```bat
.\bin\kc.bat start-dev --http-port=8180
```
et dans `.env.pca` : `KEYCLOAK_URL=http://localhost:8180` et `VITE_KEYCLOAK_URL=http://localhost:8180`.

---

## Étape 2 — Créer le realm `pca-app`

1. Ouvrir **http://localhost:8080** (ou 8180 si tu as changé le port).
2. Se connecter à l’**Admin Console** (admin / admin).
3. En haut à gauche : menu déroulant où il est écrit **master** → **Create realm**.
4. **Realm name** : `pca-app`
5. Cliquer **Create**.

Tu es maintenant dans le realm **pca-app**.

---

## Étape 3 — Créer le client frontend `pca-web`

Ce client est utilisé par le front React (bouton « Continuer avec Keycloak »).

1. Menu gauche : **Clients** → **Create client**.

2. **General settings**
   - Client type : **OpenID Connect**
   - Client ID : `pca-web`
   - **Next**

3. **Capability config**
   - **Client authentication** : **OFF** (client public)
   - **Next**

4. **Login settings**
   - **Root URL** : `http://localhost:3003`
   - **Valid redirect URIs** : `http://localhost:3003/*`
   - **Valid post logout redirect URIs** : `http://localhost:3003`
   - **Web origins** : `http://localhost:3003`
   - **Save**

> Si ton front tourne sur un autre port (ex. 3002), remplace `3003` par ce port partout.

---

## Étape 4 — Créer un utilisateur de test (visible côté front)

1. Menu gauche : **Users** → **Create new user**.

2. Renseigner par exemple :
   - **Username** : `test`
   - **Email** : `test@pca.local`
   - **First name** : Test
   - **Last name** : User
   - **Email verified** : ON

3. **Create**.

4. Onglet **Credentials** → **Set password**
   - Password : `test` (ou autre)
   - **Temporary** : OFF
   - **Save**.

Cet utilisateur pourra se connecter via « Continuer avec Keycloak » et apparaîtra sur le front (nom, email, rôles).

---

## Étape 5 — (Optionnel) Créer le client backend `pca-service`

Permet au serveur Node de créer des utilisateurs dans Keycloak (ex. après « Continuer avec Google »).

1. **Clients** → **Create client**.

2. **General settings**
   - Client type : **OpenID Connect**
   - Client ID : `pca-service`
   - **Next**

3. **Capability config**
   - **Client authentication** : **ON**
   - **Service accounts roles** : activer (ou option équivalente)
   - **Next**

4. **Login settings** : **Save** (pas de redirect URI pour ce client).

5. Une fois le client créé :
   - Onglet **Credentials** : copier le **Client secret**.
   - Dans `.env.pca` :
     ```
     KEYCLOAK_ADMIN_CLIENT_ID=pca-service
     KEYCLOAK_ADMIN_CLIENT_SECRET=<le-secret-copié>
     ```

6. **Service account roles** (ou **Roles** → « Service account roles » pour `pca-service`) :
   - **Assign role** → **Filter by clients** → **realm-management**
   - Sélectionner **manage-users** → **Assign**.

---

## Étape 6 — Vérifier ton `.env.pca`

Les variables suivantes doivent correspondre à ta config Keycloak :

```env
# Keycloak — backend
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=pca-app
KEYCLOAK_CLIENT_ID=pca-web

# Keycloak — frontend (Vite)
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=pca-app
VITE_KEYCLOAK_CLIENT_ID=pca-web

# Optionnel : création des users OAuth dans Keycloak
KEYCLOAK_ADMIN_CLIENT_ID=pca-service
KEYCLOAK_ADMIN_CLIENT_SECRET=PxjVZHxInbIlZU28an2lvsV46Hj7xgSc
```

Si Keycloak tourne sur 8180, mets 8180 à la place de 8080 pour `KEYCLOAK_URL` et `VITE_KEYCLOAK_URL`.

---

## Étape 7 — Lancer l’app et voir l’utilisateur côté front

1. **Démarrer l’API + front** (depuis la racine du projet) :
   ```bat
   .\start.bat
   ```
   ou :
   ```bat
   node scripts/start.cjs
   ```
   ou encore :
   ```bat
   npm run server
   ```
   puis dans un autre terminal :
   ```bat
   npm run dev
   ```
   (selon comment ton projet est configuré — le front doit être sur le port indiqué dans les redirect URIs, ex. 3003).

2. Ouvrir le front : **http://localhost:3003** (ou le port utilisé).

3. Aller sur **Connexion** (ou **Login**).

4. Cliquer sur **« Continuer avec Keycloak »**.

5. Tu es redirigé vers la page de login Keycloak. Saisir :
   - **Username** : `test`
   - **Password** : `test`

6. Après connexion, Keycloak te renvoie sur l’app. Tu dois être connecté et redirigé (ex. vers le tableau de bord).

7. **Voir l’utilisateur côté front** :
   - Aller sur **Mon compte** (ou **Account**).  
   Tu dois voir le **nom**, l’**email** et éventuellement les **rôles** de l’utilisateur Keycloak (`test` / `test@pca.local`).

---

## Résumé des URLs

| Rôle              | URL                          |
|-------------------|------------------------------|
| Keycloak Admin    | http://localhost:8080        |
| Front PCA         | http://localhost:3003        |
| API PCA (Node)    | http://localhost:3005         |

---

## Dépannage

- **« Continuer avec Keycloak » n’apparaît pas**  
  Vérifier que `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM` et `VITE_KEYCLOAK_CLIENT_ID` sont bien renseignés dans `.env.pca` et que le front a été redémarré après modification du `.env`.

- **Erreur de redirect après login Keycloak**  
  Les **Valid redirect URIs** du client `pca-web` doivent contenir exactement l’URL du front (ex. `http://localhost:3003/*`). Pas de slash final dans `http://localhost:3003/*`.

- **Port 8080 déjà utilisé**  
  Lancer Keycloak sur 8180 :  
  `.\bin\kc.bat start-dev --http-port=8180`  
  et adapter `KEYCLOAK_URL` / `VITE_KEYCLOAK_URL` dans `.env.pca`.

- **L’utilisateur n’apparaît pas sur Mon compte**  
  Vérifier que tu t’es bien connecté via « Continuer avec Keycloak » (et pas via email/mot de passe du formulaire ou Google). Après login Keycloak, le front reçoit le token et affiche les infos (nom, email, rôles) sur la page Mon compte.
