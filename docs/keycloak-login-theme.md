# Personnaliser la page de connexion Keycloak

L’authentification PCA utilise **Keycloak en OpenID Connect** : l’utilisateur est redirigé vers la page de connexion Keycloak, puis renvoyé sur l’application avec un token. Vous pouvez personnaliser cette page (couleurs, logo, textes).

## 1. Activer un thème de login dans le realm

1. Ouvrez la console Keycloak : **http://localhost:8080** (ou votre URL Keycloak).
2. Sélectionnez le realm **pca-app**.
3. Menu **Realm settings** (Paramètres du royaume).
4. Onglet **Themes**.
5. **Login theme** : choisissez un thème existant (ex. `keycloak`) ou un thème personnalisé (voir ci‑dessous).
6. **Account theme** (optionnel) : pour la page « Mon compte ».
7. Enregistrez.

## 2. Créer un thème de login personnalisé

Les thèmes Keycloak se trouvent dans le répertoire d’installation de Keycloak, sous `themes/`.

### Option A : Copier et modifier un thème existant

1. Dans le dossier Keycloak (ex. `keycloak-26.5.4`), allez dans **themes**.
2. Copiez le dossier **keycloak** (ou **base**) vers un nouveau dossier, par ex. **pca**.
3. Structure typique :
   ```
   themes/
   └── pca/
       └── login/
           ├── theme.properties
           ├── login.ftl          (template de la page)
           ├── login-reset-password.ftl
           ├── resources/
           │   ├── css/
           │   │   └── login.css
           │   ├── img/
           │   │   └── logo.png   (votre logo)
           │   └── js/
   ```
4. Modifiez :
   - **resources/css/login.css** : couleurs, polices, mise en page.
   - **resources/img/logo.png** : remplacez par le logo PCA.
   - **login.ftl** : textes, structure HTML (si besoin).
5. Redémarrez Keycloak.
6. Dans **Realm settings** > **Themes**, définissez **Login theme** = **pca**.

### Option B : Thème par défaut Keycloak (sans fichier personnalisé)

Sans créer de thème, vous pouvez au moins :
- **Realm settings** > **General** : **Display name** = « PCA » (affiché en haut de la page de login).
- **Realm settings** > **Themes** : **Login theme** = **keycloak** (thème par défaut).

## 3. Personnalisation rapide (messages)

- **Realm settings** > **Localization** : activez **Internationalization**, ajoutez les langues (fr, en), puis **Realm settings** > **Realm localization** pour surcharger les libellés (ex. « Log in » → « Connexion PCA »).

## 4. Inscription (création de compte)

Pour que le bouton « Créer un compte » redirige vers l’inscription Keycloak :

1. **Realm settings** > **Login** (ou **Authentication**).
2. Activez **User registration** (Inscription utilisateur).
3. La page de login Keycloak affichera un lien « Register » / « Créer un compte » qui mène à la page d’inscription Keycloak.

L’application PCA utilise déjà `registerWithKeycloak()` qui redirige vers cette page si le thème Keycloak l’expose.

## 5. Google / GitHub depuis la page Keycloak

Pour avoir « Se connecter avec Google » sur la **page Keycloak** (et non plus sur une page de l’app) :

1. **Identity providers** (Fournisseurs d’identité).
2. **Add provider** > **Google** (ou **GitHub**).
3. Renseignez Client ID et Client Secret (ceux de Google / GitHub).
4. Sauvegardez.

Les utilisateurs verront alors les boutons Google/GitHub directement sur la page de connexion Keycloak.
