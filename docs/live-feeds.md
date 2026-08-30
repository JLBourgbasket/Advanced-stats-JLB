# Connexion des statistiques live

## Ce qui est techniquement possible

L’application peut recevoir des statistiques en direct, les convertir vers son
format interne puis recalculer les indicateurs avancés après chaque mise à jour.
L’accès ne doit cependant pas reposer sur une URL publique copiée depuis une
page de live-score. Il faut un accès API contractuel, une clé serveur et
l’identifiant officiel du match.

## Connecteurs à prévoir

### Betclic Élite — Synergy Stats DataCore

Le connecteur live pertinent est **Synergy Stats DataCore Streaming API**. Il
permet l’envoi et la réception d’événements en temps réel. L’API « Synergy
Basketball » d’analyse vidéo est différente : ses données enrichies sont
principalement disponibles après le match.

Accès requis auprès du fournisseur ou de la LNB :

- URL et protocole du flux DataCore utilisé pour la compétition ;
- identifiants serveur et méthode d’authentification ;
- identifiants compétition, saison, équipe et match ;
- schéma des messages et droit de stockage/réaffichage.

Documentation :
https://developer.connect.sportradar.com/datacore/basketball_stream.html

### EuroCup — Sportradar Global Basketball

Le connecteur pertinent est **Sportradar Global Basketball** avec les endpoints
de résumé/timeline et, si le contrat le permet, les Push Events ou Push
Statistics. La présence exacte de l’EuroCup et le niveau de détail doivent être
confirmés dans la couverture souscrite.

Accès requis auprès de Sportradar :

- clé API serveur ;
- package Global Basketball et accès Realtime/Push ;
- identifiant de la compétition EuroCup et identifiants de matchs ;
- droit de stockage/réaffichage des données.

Documentation :
https://developer.sportradar.com/basketball/reference/global-basketball-overview

## Architecture cible

1. L’administrateur choisit le fournisseur et saisit l’identifiant du match.
2. Un service serveur ouvre le flux ou interroge l’API. Les clés ne sont jamais
   envoyées au navigateur et ne portent jamais le préfixe `NEXT_PUBLIC_`.
3. Un adaptateur transforme les messages fournisseur vers le même modèle
   interne : score, tirs, lancers, rebonds, passes, pertes, fautes et temps.
4. Supabase conserve un instantané versionné et diffuse les mises à jour à
   l’interface avec Realtime.
5. Le moteur recalcule les statistiques avancées et le rapport.
6. Une synchronisation REST finale réconcilie le match, car un flux push peut
   être interrompu et laisser manquer certains événements.

Pour un flux WebSocket ou streaming long, prévoir un petit worker persistant.
Une fonction Netlify classique n’est pas adaptée à une connexion ouverte
pendant tout un match. Les webhooks HTTP ou les snapshots REST peuvent en
revanche être traités par une fonction Netlify ou Supabase Edge Function.

## Prochaine entrée nécessaire

Avant de coder un adaptateur réel, fournir pour chaque compétition un exemple
de payload anonymisé, la documentation liée au contrat, le type
d’authentification et un identifiant de match de test. Aucune clé ne doit être
ajoutée à GitHub.
