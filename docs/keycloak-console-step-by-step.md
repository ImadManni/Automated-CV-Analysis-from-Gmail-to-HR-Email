# Keycloak – Configuration pas à pas (connexion front PCA)

Votre front utilise :
- **URL Keycloak :** `http://localhost:8080`
- **Realm :** `pca-app`
- **Client front :** `pca-web`
- **Front tourne sur :** `http://localhost:3003`

Suivez les étapes ci‑dessous dans l’ordre dans la console Keycloak.

---

## Partie 1 : Créer le realm `pca-app`

1. Dans la console Keycloak, en haut à gauche vous voyez le **nom du realm** (ex. « master »).
2. Cliquez sur ce **dropdown** (nom du realm).
3. Cliquez sur **« Create realm »**.
4. **Realm name** : saisissez exactement **`pca-app`**.
5. Laissez les autres options par défaut.
6. Cliquez sur **« Create »**.

Vous êtes maintenant dans le realm **pca-app** (vérifiez le nom en haut à gauche).

---

## Partie 2 : Créer le client pour le front (`pca-web`)

Ce client est utilisé par la page de connexion (bouton « Continuer avec Keycloak »).

1. Dans le menu de gauche : **Clients** → **Clients**.
2. Cliquez sur **« Create client »**.

### Étape 2a – General settings

3. **Client type** : laissez **OpenID Connect**.
4. **Client ID** : saisissez exactement **`pca-web`**.
5. Cliquez sur **« Next »**.

### Étape 2b – Capability config

6. **Client authentication** : **OFF** (client public, pas de secret).
7. **Authorization** : OFF.
8. **Authentication flow** :
   - **Standard flow** : **ON** (pour login navigateur).
   - **Direct access grants** : à votre convenance (ON si vous voulez tester avec mot de passe plus tard).
9. Cliquez sur **« Next »**.

### Étape 2c – Login settings

10. Renseignez **exactement** :

    - **Root URL** : `http://localhost:3003`
    - **Home URL** : `http://localhost:3003`
    - **Valid redirect URIs** :  
      `http://localhost:3003`  
      puis cliquez **« Add »** et ajoutez aussi :  
      `http://localhost:3003/*`
    - **Valid post logout redirect URIs** :  
      `http://localhost:3003`  
      et `http://localhost:3003/*`
    - **Web origins** :  
      soit laisser **« + »** (Keycloak déduira de vos redirect URIs),  
      soit saisir : `http://localhost:3003`

11. Cliquez sur **« Save »**.

Le client **pca-web** est prêt pour le front.

---

## Partie 3 : (Optionnel) Client pour le backend `pca-service`

Si votre backend Node crée des utilisateurs dans Keycloak à l’inscription / connexion (email/mot de passe ou OAuth), il a besoin d’un client confidentiel.

1. **Clients** → **« Create client »**.
2. **Client ID** : **`pca-service`** → **Next**.
3. **Client authentication** : **ON**.
4. **Service accounts roles** : **ON** → **Save**.
5. Onglet **Credentials** : copiez le **Client secret** et mettez‑le dans `.env.pca` dans `KEYCLOAK_ADMIN_CLIENT_SECRET=...`.
6. Onglet **Service account roles** :
   - **Client roles** : choisir **realm-management**.
   - Assigner au moins : **manage-users**, **view-users**, **view-realm**.

Votre `.env.pca` contient déjà `KEYCLOAK_ADMIN_CLIENT_ID=pca-service` et une valeur pour `KEYCLOAK_ADMIN_CLIENT_SECRET` : remplacez par le secret copié ici si vous venez de recréer le client.

---

## Partie 4 : Créer un utilisateur de test (pour vérifier la connexion)

1. Menu de gauche : **Users** → **Users**.
2. **« Create new user »**.
3. **Username** : par ex. `test@example.com` (ou un email).
4. **Email** : le même (ex. `test@example.com`).
5. **First name** / **Last name** : optionnel.
6. **Email verified** : ON.
7. Cliquez sur **« Create »**.
8. Onglet **Credentials** :
   - **Set password** : choisir un mot de passe (ex. `Test123!`).
   - **Temporary** : OFF (pour ne pas être forcé de le changer au premier login).
9. **Save**.

---

## Partie 5 : Vérifier les variables du front

Dans le projet, fichier **`.env.pca`** (et éventuellement `.env` si le front lit celui‑ci), vérifiez :

```env
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=pca-app
VITE_KEYCLOAK_CLIENT_ID=pca-web
```

Si vous modifiez `.env.pca`, redémarrez le serveur de dev front (**npm run dev**) pour recharger les variables.

---

## Partie 6 : Tester la connexion depuis le front

1. **Keycloak** doit tourner sur **http://localhost:8080**.
2. **Front** : `npm run dev` → ouvrir **http://localhost:3003**.
3. Aller sur la page **Connexion** (bouton « Connexion » ou URL `/login`).
4. Cliquer sur **« Continuer avec Keycloak »**.
5. Vous devez être redirigé vers Keycloak (page de login Keycloak).
6. Se connecter avec l’utilisateur de test (ex. `test@example.com` / `Test123!`).
7. Après connexion, Keycloak vous renvoie sur **http://localhost:3003/** et vous devez être connecté (tableau de bord, etc.).

---

## Dépannage rapide

- **« Invalid redirect uri »**  
  → Vérifiez que **Valid redirect URIs** contient bien `http://localhost:3003` et `http://localhost:3003/*` (sans faute, sans slash final en trop sur 3003).

- **Bouton Keycloak absent ou rien ne se passe**  
  → Vérifiez `VITE_KEYCLOAK_*` dans `.env.pca`, redémarrez `npm run dev`, et que Keycloak est bien sur http://localhost:8080.

- **Page Keycloak ne charge pas (script /js/keycloak.js)**  
  → Vérifiez que vous accédez bien à Keycloak en **http** (pas https) sur le port 8080.

- **Utilisateurs « Se connecter » / « S’inscrire »**  
  → Pour que les comptes créés sur la plateforme (email/mot de passe ou OAuth) apparaissent dans Keycloak, le backend Node doit créer/mettre à jour les users via l’API Admin Keycloak avec le client **pca-service** (voir `server/keycloak-admin.js` et la doc associée).
