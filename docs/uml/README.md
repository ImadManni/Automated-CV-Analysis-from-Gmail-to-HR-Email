# Conception UML — Automated CV Analysis (Gmail → HR Email)

Ce dossier contient la conception UML du projet PCA (use case + diagramme de classes) au format **PlantUML**, pour génération d’images ou utilisation par des outils de génération de code.

## Fichiers

| Fichier | Description |
|--------|-------------|
| `use-case.puml` | Diagramme de cas d’utilisation (PlantUML) |
| `class-diagram.puml` | Diagramme de classes (PlantUML) |
| `use-case.mmd` | Use cases en Mermaid (prévisualisation GitHub / VS Code) |
| `class-diagram.mmd` | Classes en Mermaid (prévisualisation GitHub / VS Code) |

## Visualiser / Générer les diagrammes

### Option 1 : PlantUML (recommandé)

1. **Installer PlantUML**  
   - [PlantUML](https://plantuml.com/) (Java requis)  
   - Ou extension VS Code : [PlantUML](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml)

2. **Générer les images** (depuis la racine du projet) :
   ```bash
   java -jar plantuml.jar docs/uml/use-case.puml docs/uml/class-diagram.puml
   ```
   Les PNG seront créés à côté des `.puml` (ex. `use-case.png`, `class-diagram.png`).

3. **Ou dans VS Code** : ouvrir un `.puml` et utiliser la commande « Preview Current Diagram » (Alt+D).

### Option 2 : En ligne

- Coller le contenu d’un fichier `.puml` sur [PlantUML Online](https://www.plantuml.com/plantuml/uml/) pour obtenir une image.

## Utilisation pour la génération de code

- Les **use cases** décrivent les fonctionnalités (accueil, localisation, dashboard, filtres, analytics, Grafana) et peuvent servir de base pour des user stories ou des tests.
- Le **diagramme de classes** reflète la structure actuelle du front-end :
  - **Domaine** : `Candidature`, `Decision`, `CandidaturesState`
  - **Store** : slice Redux, `RootState`, actions
  - **Config** : `config/ui`
  - **Composants** : `App`, `Layout`, `Header`, `Footer`, `HomePage`, `DashboardPage`, `StatsCards`, `CandidaturesTable`, `AnalyticsCharts`, `DetailedAnalytics`, `GrafanaSection`

Tu peux importer les `.puml` dans des outils (Enterprise Architect, StarUML, etc.) ou utiliser des générateurs (squelettes TypeScript/React) en t’appuyant sur les noms de classes et attributs du diagramme.

## Résumé du concept projet

- **Workflow** : Gmail → n8n (extraction PDF/DOCX, analyse IA) → décision (accepté / refusé / à revoir / non lisible) → synthèse pour la RH.
- **Application web** : présentation PCA, tableau de bord des candidatures (données mock), analytics détaillées, lien vers dashboard Grafana.
- **Stack** : React, Redux, TypeScript, Vite, Framer Motion, React Icons.
