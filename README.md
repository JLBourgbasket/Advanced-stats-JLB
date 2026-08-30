# JL Bourg · Advanced Stats

Application d’analyse automatisée des boxscores de la JL Bourg. Le premier MVP
utilise le match JL Bourg – Lions de Genève du 29 août 2026 comme jeu de données
de validation.

## Fonctionnalités disponibles

- calcul des statistiques avancées collectives : possessions, TS%, eFG%, ORB%,
  DRB%, FGAST%, AST Ratio, TOV%, ORtg, DRtg et Net Rating ;
- comparaison aux cibles collectives JL Bourg 2026–27 ;
- statistiques individuelles contextualisées par les minutes ;
- référentiels individuels par joueur et codes couleur ;
- estimations boxscore ORtg/DRtg individuelles, séparées des ratings possession
  par possession ;
- tableau joueurs interactif, graphique des quart-temps et export PDF ;
- schéma PostgreSQL/Supabase initial.

## Installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

L’application est ensuite disponible sur `http://localhost:3000`.

## Variables Supabase

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=votre-cle-publique
```

La clé `service_role` ne doit jamais être placée dans une variable
`NEXT_PUBLIC_*`, dans le dépôt ou dans le navigateur.

## Base de données

La migration initiale est disponible dans
`supabase/migrations/202608300001_initial_schema.sql`. Elle crée les tables
équipes, joueurs, référentiels, matchs, boxscores et rapports.

Les tables ont la sécurité RLS activée. Les politiques d’accès seront ajoutées
avec l’authentification et les rôles du staff.

## Déploiement Netlify

1. Importer ce dépôt dans Netlify.
2. Utiliser `npm run build` comme commande de construction.
3. Ajouter les deux variables publiques Supabase dans l’environnement Netlify.
4. Déployer.

## Conventions statistiques

- **FGAST% collectif** = `AST / FGM`. Les paniers à trois points sont inclus
  dans les FGM ; les lancers francs ne sont pas des field goals.
- **AST% individuel** estime la part des paniers des coéquipiers assistés pendant
  les minutes du joueur.
- Les ORtg/DRtg individuels du MVP sont des estimations fondées sur le boxscore.
  Des ratings réellement « on-court » nécessitent du play-by-play ou des
  données de rotations.

