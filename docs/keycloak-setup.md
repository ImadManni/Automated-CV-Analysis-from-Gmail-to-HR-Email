# Keycloak — intégration et test

## 1. Démarrer Keycloak

### Option A — En local (sans Docker, port 8080)

**Prérequis** : Java (OpenJDK 17 ou 21). Vérifier avec `java -version`.

1. **Télécharger Keycloak**  
   - https://www.keycloak.org/downloads  
   - Choisir **Keycloak 24** (ou dernière LTS) → **ZIP**
2. **Extraire** le ZIP. Le dossier extrait s’appelle souvent `keycloak-24.0.x` ou `keycloak-26.5.4`. Tu peux le laisser sur le Bureau ou le mettre à la racine du projet.
3. **Lancer Keycloak** :
   - **Depuis le dossier du projet PCA** (où se trouve `scripts/`) : `scripts\run-keycloak.bat` ou `.\scripts\start-keycloak.ps1`. Le script cherche Keycloak dans le projet puis sur le Bureau.
   - **Depuis le dossier Keycloak** (ex. `C:\...\keycloak-26.5.4`) : il n’y a pas de `scripts` ici, lance directement : **`.\bin\kc.bat start-dev`**
4. **Premier démarrage** : Keycloak demande de créer un utilisateur admin (ex. `admin` / `admin`). À faire une seule fois.
5. **Vérifier** : http://localhost:8080 → Admin Console → connexion avec l’admin créé.

Ensuite, configurer le realm, le client et l’utilisateur de test comme en **§ 2** ci‑dessous.

---

**Option B — Docker Compose**

```bash
docker-compose up -d keycloak
```

Attendre ~1 minute. Vérifier : http://localhost:8080 (admin / admin).

**Option C — Docker run**

```bash
docker run -d -p 8080:8080 --name pca-keycloak -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:24 start-dev
```

---

## 2. Configurer Keycloak (Admin Console)

1. **Ouvrir** http://localhost:8080  
2. **Connexion** : Admin Console → utilisateur `admin` / mot de passe `admin`

### Créer le realm

1. Menu déroulant en haut à gauche (actuellement "master") → **Create realm**
2. **Realm name** : `pca`  
3. **Create**

### Créer le client (application)

1. Menu gauche : **Clients** → **Create client**
2. **General settings**  
   - Client type : **OpenID Connect**  
   - Client ID : `pca-frontend`  
   - **Next**
3. **Capability config**  
   - Client authentication : **OFF** (client public)  
   - **Next**
4. **Login settings**  
   - Valid redirect URIs : `http://localhost:3003/*`  
   - Valid post logout redirect URIs : `http://localhost:3003`  
   - Web origins : `http://localhost:3003`  
   - **Save**

### Créer un utilisateur de test

1. Menu gauche : **Users** → **Create new user**
2. **Username** : `test` (ou autre)  
3. **Email** : `test@pca.local`  
4. **First name** : Test  
5. **Last name** : User  
6. **Email verified** : ON  
7. **Create**
8. Onglet **Credentials** → **Set password**  
   - Password : `test` (ou autre)  
   - Temporary : **OFF**  
   - **Save**

### (Optionnel) Rôles

1. Menu gauche : **Realm roles** → **Create role**  
   - Ex. `user`, `admin`, `hr`
2. **Users** → cliquer sur l’utilisateur `test` → onglet **Role mapping** → **Assign role** → attribuer les rôles voulus.

---

## 4. Google OAuth dans Keycloak (connexion Google pour les utilisateurs Keycloak)

Pour permettre aux utilisateurs de se connecter avec leur compte **Google** via Keycloak (bouton « Sign in with Google » sur la page de login Keycloak) :

### 4.1 Google Cloud Console

1. Aller sur https://console.cloud.google.com/apis/credentials  
2. Ouvrir ton projet (ou en créer un).  
3. Créer un **identifiant client OAuth 2.0** (ou réutiliser celui existant) :  
   - Type d’application : **Web**  
   - **URI de redirection autorisées** : ajouter **exactement** :
     - `http://localhost:8080/realms/pca/broker/google/endpoint`  
     - (En production, ajouter aussi `https://ton-keycloak/realms/pca/broker/google/endpoint`)  
4. Noter le **Client ID** et le **Client secret**.

### 4.2 Keycloak — Identity Provider Google

1. Keycloak Admin → realm **pca**  
2. Menu gauche : **Identity providers** → **Add provider**  
3. Choisir **Google**  
4. Renseigner :
   - **Alias** : `google` (ou laisser par défaut)
   - **Client ID** : le Client ID Google (ex. celui de ton `.env.pca` ou un dédié Keycloak)
   - **Client secret** : le Client secret Google  
5. **Save**

### 4.3 Test pas à pas : utilisateur Google → visible dans Keycloak

Suivre ces étapes dans l’ordre pour vérifier qu’un utilisateur qui se connecte via Google apparaît bien dans Keycloak.

| Étape | Où | Action |
|-------|-----|--------|
| **1** | Google Cloud Console | Créer ou ouvrir un client OAuth 2.0 (type Web). Ajouter dans **URI de redirection autorisées** : `http://localhost:8080/realms/pca/broker/google/endpoint`. Noter **Client ID** et **Client secret**. |
| **2** | Keycloak Admin | Realm **pca** → **Identity providers** → **Add provider** → **Google**. Coller Client ID et Client secret → **Save**. |
| **3** | Keycloak Admin | Vérifier que le realm **pca** et le client **pca-frontend** existent (voir § 2). Redirect URI du client : `http://localhost:3003/*`. |
| **4** | App PCA | Démarrer l’app (`npm run start`). Ouvrir **http://localhost:3003**. |
| **5** | Page de connexion | Cliquer sur **« Continuer avec Keycloak »**. Tu es redirigé vers la page de login Keycloak. |
| **6** | Page Keycloak | Cliquer sur **« Sign in with Google »** (ou le bouton Google). Choisir un compte Google et autoriser. |
| **7** | Après Google | Tu reviens sur Keycloak puis sur l’app PCA, connecté. |
| **8** | Keycloak Admin | Realm **pca** → **Users**. Tu dois voir un **nouvel utilisateur** avec le même email que le compte Google (ou un username dérivé). Cliquer dessus pour voir les infos (email, first/last name, federated identity Google). |

Si l’utilisateur n’apparaît pas dans **Users**, vérifier que l’alias du provider Google dans Keycloak est bien `google` et que l’URI de redirection dans Google Console est exactement `http://localhost:8080/realms/pca/broker/google/endpoint`.

### 4.4 Résumé rapide (déjà configuré)

1. Déconnecte-toi de Keycloak si besoin.  
2. Ouvre l’app PCA → **Connexion** → **Continuer avec Keycloak**.  
3. Sur la page de login Keycloak, cliquer sur **« Sign in with Google »**.  
4. S’authentifier avec Google → retour sur l’app. L’utilisateur est créé ou lié automatiquement dans le realm `pca` (vérifiable dans **Users**).

**Remarque** : Tu peux utiliser le même **Client ID / Client secret** Google que pour l’OAuth direct de l’app (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET dans `.env.pca`), à condition d’avoir ajouté dans Google Console l’URI de redirection Keycloak :  
`http://localhost:8080/realms/pca/broker/google/endpoint`

---

## 3. Tester depuis l’app PCA

1. **Démarrer** l’app (API + front) : `npm run start` ou `.\start.bat`
2. Ouvrir **http://localhost:3003**
3. **Connexion** → bouton **« Continuer avec Keycloak »**
4. Saisir les identifiants Keycloak (ex. `test` / `test`)
5. Après redirection, vous êtes connecté ; **Mon compte** affiche les rôles si vous en avez attribué.

---

## Configuration (.env.pca)

Les variables suivantes doivent être définies (déjà présentes si Keycloak est activé) :

- **Backend** : `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`
- **Frontend** : `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`

Exemple : `KEYCLOAK_URL=http://localhost:8080`, realm `pca`, client `pca-frontend`.

---

## 5. Utilisateurs OAuth direct (Google/GitHub) créés automatiquement dans Keycloak

Si tu veux que les utilisateurs qui se connectent via **« Continuer avec Google »** ou **« Continuer avec GitHub »** (sans passer par la page Keycloak) apparaissent quand même dans la liste **Users** de Keycloak, le backend peut les créer automatiquement via l’API Admin Keycloak.

### 5.1 Créer le client backend (service account) dans Keycloak

1. Keycloak Admin → realm **pca** → **Clients** → **Create client**
2. **General settings**  
   - Client type : **OpenID Connect**  
   - Client ID : `pca-backend`  
   - **Next**
3. **Capability config**  
   - Client authentication : **ON**  
   - **Service accounts roles** : activer (coche ou option prévue pour ce client)  
   - **Next**
4. **Login settings** : **Save** (pas besoin de redirect URI pour un client backend)
5. Une fois le client créé, onglet **Credentials** : copier le **Client secret**
6. Onglet **Service account roles** (ou **Roles** puis choisir "Service account roles" pour `pca-backend`) :  
   - **Assign role** → **Filter by clients** → choisir **realm-management**  
   - Sélectionner le rôle **manage-users** → **Assign**
7. Dans ton `.env.pca` (à la racine du projet), ajouter :
   ```
   KEYCLOAK_ADMIN_CLIENT_ID=pca-backend
   KEYCLOAK_ADMIN_CLIENT_SECRET=le-secret-copié-à-l-étape-5
   ```
8. Redémarrer le serveur PCA. Désormais, à chaque connexion réussie via **Continuer avec Google** ou **Continuer avec GitHub**, l’utilisateur est créé dans Keycloak (realm **pca**) s’il n’existe pas déjà (recherche par email).

### 5.2 Tester

1. Configurer `KEYCLOAK_ADMIN_CLIENT_ID` et `KEYCLOAK_ADMIN_CLIENT_SECRET` comme ci-dessus.
2. Sur la page de connexion de l’app, cliquer sur **« Continuer avec Google »** (ou GitHub) et se connecter avec un compte (ex. `imadmanni@gmail.com`).
3. Après redirection, aller dans Keycloak Admin → **Users** : l’utilisateur doit apparaître avec l’email utilisé.

---

## Rôles et routes protégées

- Les rôles Keycloak (realm ou client) sont exposés dans `GET /api/auth/me` et dans la page **Mon compte**.
- Pour restreindre une route à un rôle :  
  `<ProtectedRoute roles={['admin']}><AdminPage /></ProtectedRoute>`
