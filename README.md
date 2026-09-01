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
- connexion Supabase, lecture publique des matchs publiés et administration
  protégée par lien email ;
- stockage privé des boxscores importés.
- prise de photo sur mobile, amélioration du contraste et conversion automatique
  en PDF A4 avant stockage privé ;
- rafraîchissement automatique du dernier match publié depuis Supabase toutes
  les 10 secondes lorsque l’application est visible.
- OCR local des boxscores LNB en image, écran de correction cellule par cellule
  et contrôles automatiques du score, des points joueurs et des minutes ;
- espace « Scouting adversaires » avec rapports collectifs et individuels,
  codes couleur menace/opportunité, historique Supabase et moyennes sur 1, 3,
  5 ou 10 matchs disponibles.
- rapport JL Bourg enrichi sans remplacement des jauges existantes : points
  d’appui, axes de progression, Four Factors, profil de tirs, historique des
  ratings, carte usage/efficacité et tableau individuel complet par match.
- séparation des espaces Live, Match JL et Historique, avec sélection d’un
  ancien match et échantillons de 1, 3, 5, 10 matchs ou saison complète ;
- classification assistée des imports : reconnaissance des alias JL Bourg,
  confirmation Match JL/scouting et choix explicite de l’équipe analysée ;
- rapport adverse complet : synthèse automatique, clés du plan de match JL,
  Four Factors, profil de tirs, score par quart-temps, tendances ORtg/DRtg,
  cartographie usage–efficacité et tableau individuel étendu.

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

## Import mobile

Sur téléphone, le bouton **Prendre une photo** ouvre directement l’appareil
photo arrière. L’application conserve l’original et fabrique dans le navigateur
un PDF A4 en niveaux de gris, redimensionné et contrasté. Cette étape prépare le
document ; l’extraction OCR et la validation des valeurs restent une étape
séparée afin de ne jamais publier un boxscore mal lu.

## Flux de statistiques live

La stratégie et les prérequis des connecteurs Betclic Élite et EuroCup sont
décrits dans [`docs/live-feeds.md`](docs/live-feeds.md). Les clés fournisseur
doivent rester dans un service serveur. Il ne faut jamais exposer une clé
Synergy ou Sportradar dans une variable `NEXT_PUBLIC_*`.

## Base de données

Les migrations Supabase sont disponibles dans `supabase/migrations/` :

- `202608300001_initial_schema.sql` crée les tables principales ;
- `202608300002_public_read_admin_write.sql` ajoute la lecture publique,
  l’administration protégée et le stockage privé des fichiers.
- `202608300003_scouting_matches.sql` distingue les matchs JL Bourg des rapports
  consacrés aux adversaires.
- `202608310004_live_match_sources.sql` ajoute l’origine import/live, le statut
  du direct, le fournisseur et l’identifiant officiel du match.

Les troisième et quatrième migrations doivent être exécutées avant la mise en
production des modules de scouting et de live.

Après la seconde migration, ajouter l’administrateur uniquement depuis le SQL
Editor Supabase, sans publier son adresse dans GitHub :

```sql
insert into public.admin_users (email)
values ('email-administrateur')
on conflict (email) do nothing;
```

Dans Supabase Auth, l’URL du site et l’URL de redirection doivent correspondre
au domaine Netlify de production.

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

## OCR des boxscores

La première version reconnaît les images PNG/JPEG du format de tableau LNB
utilisé pour Chalon/Saône–Dijon. Tesseract s’exécute dans le navigateur : le
document n’est pas envoyé à un service OCR tiers. Les totaux, les deux équipes,
les quart-temps et les lignes joueurs sont proposés dans un écran de validation.
Le mode tableau pleine page est également validé sur Cholet–Nanterre. La
publication est bloquée si les noms, scores, tirs ou lignes joueurs nécessaires
au calcul n’ont pas été reconnus.
Les PDF natifs restent stockés, mais devront être convertis en image avant OCR
jusqu’à l’ajout du rendu automatique des pages PDF.
