# 📌 Backlog Produit & Suivi des Améliorations — Korom

> Ce backlog recense les fonctionnalités, améliorations et enrichissements métier identifiés lors de l'analyse critique de logiciels historiques (**Le Sage** / TheFreeCat) et des retours utilisateurs, tout en préservant l'esprit moderne, épuré, automatisé et axé sur l'expérience utilisateur de **Korom**.

---

## 🎯 Vue Synthétique par Priorité

| ID | Épic | User Story | Priorité | Statut |
| :--- | :--- | :--- | :--- | :--- |
| **US-1.1** | Identifiants Œuvres | Ajout du Code SACEM (COCV) et du N° de Cotage dans le modèle de données Œuvre | 🔴 P1 | ✅ Complété |
| **US-1.2** | Réconciliation SACEM | Intégration du Code SACEM (COCV) dans le moteur de Smart Matching déterministe | 🔴 P1 | ✅ Complété |
| **US-1.3** | Interface Catalogue | Affichage, filtrage et édition du Code SACEM et du Cotage (table, cartes, drawer) | 🔴 P1 | ✅ Complété |
| **US-2.1** | Règles Financières | Paramétrage d'un seuil minimum de versement (ex. 50 €) dans les réglages | 🟡 P2 | ✅ Complété |
| **US-2.2** | Clôture Comptable | Gestion des soldes reportés à nouveau (avances résiduelles et micro-montants) | 🟡 P2 | ✅ Complété |
| **US-2.3** | Documents d'Auteurs | Messages légaux et mentions conditionnelles personnalisables en pied de décompte | 🟡 P2 | ✅ Complété |
| **US-3.1** | Audiovisuel & Projets | Rattachement d'un Contrat à un `WorkGroup` (Série / Album) avec héritage automatique | 🟢 P3 | ✅ Complété |
| **US-3.2** | Affiliations Internationales | Sociétés de gestion distinctes DE (Exécution) et DR (Reproduction) par ayant droit | 🟢 P3 | ✅ Complété |
| **US-3.3** | Export CWR | Options de filtrage de l'export CWR par Groupe d'œuvres et période de dépôt | 🟢 P3 | ✅ Complété |
| **US-4.1** | Contrats Généraux | Ingestion native du fichier SACEM CGP1 (Contrats Généraux de Publication & Sous-Édition) | 🔵 P4 | ✅ Complété |
| **US-4.2** | Ayants Droit & Héritiers | Module Successions d'auteurs, Héritiers & Redirection de paiement (Mandataire / Tiers payé) | 🔵 P4 | ✅ Complété |
| **US-4.3** | Cycle de Clôture | Workflow de clôture périodique formelle & verrouillage immuable (DRAFT ➔ LOCKED ➔ PAID) | 🔵 P4 | ✅ Complété |
| **US-4.4** | Diagnostic Catalogue | Atelier de diagnostic & contrôle de cohérence express (Audit 1-clic & Auto-réparation) | 🔵 P4 | ✅ Complété |
| **US-4.5** | Multi-Devises | Table des parités de change BCE & conversion automatique des relevés étrangers (USD/GBP) | 🔵 P4 | ✅ Complété |
| **US-4.6** | Décomptes Avancés | Options de présentation des décomptes (Territoires, Projets audiovisuels, Bilingue FR/EN) | 🔵 P4 | ✅ Complété |
| **US-4.7** | Télétransmission Bancaire | Génération du fichier de virement bancaire groupé SEPA XML ISO 20022 (`pain.001`) | 🔵 P4 | ✅ Complété |
| **US-5.1** | Ergonomie Drawer | Refonte du Tiroir d'Œuvre en sous-onglets & Action 1-clic « Équilibrer le reste » | 🟣 P5 | ✅ Complété |
| **US-5.2** | Triage Black Box | Passerelle Black Box ➔ Création d'Œuvre 1-clic & Tri par montant brut décroissant | 🟣 P5 | ✅ Complété |
| **US-5.3** | Actions de Masse | Dock flottant enrichi au Catalogue (Export CWR 2.1 groupé & rattachement TF1) | 🟣 P5 | ✅ Complété |
| **US-5.4** | Formats & Préférences | Support natif Excel SACEM (`.xlsx`) & Mémorisation des préférences (`localStorage`) | 🟣 P5 | ✅ Complété |
| **US-5.5** | Architecture Frontend | Découpage modulaire des pages monolithiques (`catalog` & `reconciliation`) | 🟣 P5 | 📝 Spécifié |
| **US-5.6** | Expérience Onboarding | Assistant de démarrage interactif (Setup Wizard) & Empty states guidés | 🟣 P5 | ✅ Complété |
| **US-5.7** | Campagnes Financières | Campagnes de répartition multi-relevés & Clôture semestrielle consolidée | 🟣 P5 | ✅ Complété |
| **US-5.8** | Dépôts & Accusés SACEM | Ingestion des accusés de réception SACEM CWR (fichiers ACK/NACK) & Suivi des dépôts | 🟣 P5 | ✅ Complété |
| **US-5.9** | Déclarations Sociales | Bordereau fiscal récapitulatif trimestriel URSSAF Limousin & IRCEC | 🟣 P5 | 📝 Spécifié |
| **US-5.10** | Navigation Universelle | Palette de commande globale `Cmd+K` (Omnibar de recherche instantanée multi-entités) | 🟣 P5 | ✅ Complété |
| **US-5.11** | Diffusion Décomptes | Export groupé ZIP & Envoi dématérialisé des décomptes par email aux auteurs | 🟣 P5 | 📝 Spécifié |
| **US-5.12** | Audiovisuel Avancé | Générateur & visualiseur de cue-sheets audiovisuelles (Format SACEM Audiovisuel) | 🟣 P5 | 📝 Spécifié |
| **US-5.13** | Document AI Contrats | Détection des contrats de co-édition, sous-groupes d'œuvres audiovisuels & alertes cession d'auteurs | 🟣 P5 | ✅ Complété |
| **US-5.14** | Architecture Multi-Sociétés | Multi-Catalogues & Multi-Entités Éditoriales (Workspace Switcher Kaptain Music / Une Musique) | 🟣 P5 | ✅ Complété |
| **US-5.15** | Coédition & Royalties | Coédition & Gestion des Droits Contrôlés (Perception pour compte de tiers / Mandats d'encaissement) | 🟣 P5 | ✅ Complété |
| **US-5.16** | Ergonomie Catalogue | États métier & cycle de vie éloquent des œuvres (« À déposer », « Informations manquantes », « Déposé & Exploité ») | 🟣 P5 | 📝 Spécifié |
| **US-5.17** | Pilotage & Dashboard | Tableau de bord exécutif : Todo list métier intelligente & Échéancier réglementaire SACEM / Sous-Édition | 🟣 P5 | 📝 Spécifié |
| **US-5.18** | Audit & Sous-Édition | Bac à sable de comparaison différentielle SACEM vs Korom & Export livraison sous-édition (CWR & XLSX) | 🟣 P5 | ✅ Complété |

---

## 📋 Détail des User Stories

### 🟢 Priorité 1 — Identifiants Métier & Réconciliation SACEM (Terminé ✅)

#### US-1.1 : Code SACEM (COCV) & N° de Cotage dans le modèle d'Œuvre
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - Ajout des champs `sacem_work_code` (10-11 chiffres) et `cotage_number` (ex. `KFC576-01`) dans `Work` (SQLModel).
  - Validation déterministe dans les schémas Pydantic (`WorkCreate`, `WorkRead`, `WorkUpdate`).
  - Migration incrémentale de base SQLite sans rupture de rétro-compatibilité.

#### US-1.2 : Smart Matching par Code SACEM (COCV)
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - Priorité absolue dans `match_statement_line_to_catalog` : `EXACT_ISWC` (1.0), `EXACT_SACEM_CODE` (1.0), `EXACT_ISRC` (0.95), Fastembed hybride.
  - Trace explicative de réconciliation enrichie et badge vert dédié dans l'inbox d'arbitrage.

#### US-1.3 : Expérience Catalogue & Drawer enrichie
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - Colonnes et badges dédiés dans la vue table haute densité et la vue cartes.
  - Section dédiée dans le tiroir d'édition latérale (`WorkDetailDrawer`) et raccourci de copie 1-clic.
  - Filtrage multi-critères instantané par Code SACEM et Cotage.

---

### 🟢 Priorité 2 — Clôture Comptable & Gestion Financière Approfondie (Terminé ✅)

#### US-2.1 : Seuil Minimum de Paiement Paramétrable
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - Paramètre déterministe `min_payment_threshold` (défaut : `50.00 €`) dans `WorkspaceSettings`.
  - Évaluation stricte dans `apply_advance_recoupment` : si net exigible < seuil, statut `BELOW_THRESHOLD` ("En réserve (< 50 €)").
  - Conservation en réserve dans `retained_reserve_balance` sans émission prématurée de note de droits.
  - KPI dédié dans la réconciliation : Total mis en réserve et compteur d'ayants droit sous le seuil.

#### US-2.2 : Report à Nouveau des Soldes (Avances résiduelles & Micro-montants)
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - Continuité comptable stricte : `previous_reserve_balance` cumulé aux redevances de la période courante.
  - Dès franchissement du seuil (ex: 35 € + 25 € = 60 € >= 50 €), déblocage automatique en `PAYABLE` et apuration de la réserve.
  - Traçabilité immuable dans `RoyaltyLedgerEntry` : `carried_forward_initial`, `retained_in_reserve`, `payout_status`.
  - Affichage clair du solde reporté sur le tableau de réconciliation, les fiches ayant droit et les décomptes d'auteur.

#### US-2.3 : Mentions Légales et Messages Conditionnels Personnalisés
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - Dictionnaire `statement_messages` dans `WorkspaceSettings` avec modèles configurables en FR & EN :
    - Règlement effectué / Payment processed
    - En réserve sous le seuil / Held in reserve below threshold (substitution dynamique `{threshold}`)
    - Solde débiteur avance / Debit balance advance recoupment
  - Affichage de la mention légale conditionnelle (CPI L132-13) sur la fiche décompte modale et dans l'export CSV.

---

### 🟢 Priorité 3 — Projets Audiovisuels & Affiliations Internationales (Terminé ✅)

#### US-3.1 : Héritage Contrat ➔ WorkGroup (Série TV / Film / Album)
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - Association de `contract_id` et `contract_reference` au niveau du modèle `WorkGroup`.
  - Héritage automatique de la référence contrat lors du rattachement d'œuvres à un projet.
  - Endpoint dédié `POST /api/v1/work-groups/{id}/apply-inheritance` pour propager rétroactivement le contrat cadre à l'ensemble des œuvres d'un projet.
  - Bandeau interactif dans l'interface catalogue avec badge contrat et bouton d'application 1-clic.

#### US-3.2 : Sociétés de Gestion DE (Exécution) et DR (Reproduction)
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - Support de `society_de` (Droit d'Exécution / Performing Rights) et `society_dr` (Droit de Reproduction Mécanique) dans les splits et le répertoire des ayants droit.
  - Table de correspondance des codes officiels CISAC (ex: 058 Sacem/SDRM, 010 ASCAP, 021 BMI, 052 PRS, 035 GEMA...).
  - Sérialisation 100% conforme aux spécifications CISAC CWR v2.1 sur les enregistrements SPU (Éditeurs) et SWR (Auteurs/Compositeurs).
  - Affichage et édition des affiliations DE/DR dans le formulaire d'œuvre, la modale d'édition, les tables catalogue et le drawer latéral.

#### US-3.3 : Options CWR avancées (Filtre par Groupe et Date)
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - Modale dédiée d'export CWR avec sélection du périmètre (Tout le catalogue vs Projet audiovisuel spécifique).
  - Filtre par plage de dates (Date de création/modification de... à...).
  - Génération de nom de fichier CWR contextualisé (ex: `CW26..._DEMAINNOUSA.V21`).
  - Badges d'information sur les filtres appliqués dans la modale de prévisualisation et téléchargement immédiat.

---

### 🔵 Priorité 4 — Fonctionnalités Métier Avancées (Inspirées de la documentation Le Sage)

#### US-4.1 : Ingestion Native des Contrats Généraux SACEM (Format CGP1) & Liaison aux Œuvres
- **Statut** : ✅ Implémenté & Validé
- **Origine Le Sage** : Module *SACEM -> Import des contrats SACEM - CGP1* (fichier `CGP1 Détail` fourni par `depot.contrat@sacem.fr`).
- **Contexte métier** : La SACEM valide et codifie chaque contrat général (sous-édition, cession générale de catalogue, mandat d'administration) sous un numéro officiel SPRD préalable au dépôt des œuvres.
- **Réalisations** :
  - Ingestion native SACEM CGP1 (enregistrements 30, 31, 40) et CSV (`backend/app/services/cgp1_parser.py`).
  - Champs `sacem_contract_number` et `cwr_contract_type` sur le modèle `Contract` et migrations de base de données automatiques.
  - Endpoint `POST /api/v1/contracts/import-cgp1` créant ou mettant à jour les contrats, normalisant les quotes-parts à 100.00 % et synchronisant les tiers dans le Répertoire des Ayants Droit.
  - Endpoint `POST /api/v1/contracts/{id}/link-works` pour lier en masse un contrat :
    1. À un projet audiovisuel / album (`WorkGroup`), avec option de préfixe de cotage.
    2. À toutes les œuvres du catalogue où l'ayant droit cocontractant est crédité (`RIGHT_HOLDER_MATCH`).
    3. À une sélection manuelle d'œuvres du catalogue (`SPECIFIC_WORKS`).
  - Interface utilisateur moderne dans l'onglet Contrats :
    - Bouton d'action supérieur « Importer Contrats SACEM (CGP1 / .csv) » avec modale de glisser-déposer et rapport d'ingestion détaillé.
    - Badges `SACEM: [N°]` et `CWR: [CODE]` sur chaque carte de contrat.
    - Bouton interactif « 🔗 Lier aux œuvres » ouvrant la modale multi-critères de rattachement au catalogue.
  - Tests automatisés validés (`test_cgp1_and_contract_linking.py`, 43/43 tests passants sur l'ensemble du backend).

#### US-4.2 : Module Successions d'Auteurs, Héritiers & Tiers Mandataires (Redirection de Paiement)
- **Statut** : ✅ Implémenté & Validé
- **Origine Le Sage** : Onglet *Fiche Acteur -> Succession* et champ *AD à payer / Acteurs spéciaux*.
- **Contexte métier** :
  - **Successions** : Au décès d'un auteur/compositeur, la SACEM ou le notaire transmet une répartition d'indivision (ex: 50% au conjoint survivant, 25% à chacun des deux enfants). L'œuvre reste signée du nom de l'auteur décédé (pour les déclarations CWR et dépôts), mais les royalties et décomptes financiers doivent être ventilés entre les héritiers légaux.
  - **Tiers Payé / Mandataire** : Un auteur peut mandater un cabinet d'avocats, une société de gestion de droits ou un représentant pour encaisser ses redevances à sa place.
- **Réalisations** :
  - **Modèle de données & Schémas** :
    - `RightHolderDirectory` enrichi avec `is_deceased`, `deceased_at`, `payout_recipient_id`, `payout_recipient_name`, `succession_active`, `succession_notes`, `heirs` (schéma `HeirShare` avec quote-part %, lien de parenté, rôle, coordonnées bancaires).
    - `RoyaltyLedgerEntry` enrichi avec `payout_recipient_id`, `payout_recipient_name`, `is_succession_payout`, `heirs_payout_details` pour traçabilité immuable au Grand Livre.
    - Migrations incrémentales automatiques de colonnes (`database.py`).
  - **Moteur de calcul de Royalties déterministe** :
    - Conservation stricte du nom, code IPI et titularité de l'auteur d'origine sur le catalogue musical, les lignes de décompte SACEM et les dépôts CWR 2.1.
    - Ventilation déterministe des redevances brutes et nettes exigibles entre héritiers selon leurs quotes-parts successorales notariales (`sum(share_pct) == 100.00%`).
    - Redirection de paiement sans couture vers le Tiers Payé désigné (mandataire, notaire, agence) avec mise à jour des coordonnées bancaires et mentions obligatoires.
    - Génération de Factures et Notes de Droits d'auteur prêtes à l'emploi avec récapitulatif détaillé de l'indivision successorale.
  - **Interface utilisateur (Répertoire & Décomptes)** :
    - Filtres rapides « Successions & Décédés » et « Tiers Payé / Mandataires » dans l'annuaire.
    - Badges contextuels en table d'ayants droit : « Décédé / Succession (X héritiers) » et « Tiers Payé ➔ [Nom] ».
    - Carte détaillée d'indivision dans les lignes dépliées de l'annuaire et dans l'onglet des décomptes de royalties.
    - Section dédiée interactive dans la modale d'édition/création avec jauge d'équilibre des quotes-parts (100.00%).
  - **Tests automatisés validés** (`backend/tests/test_succession_and_mandataire.py`, 47/47 tests passants sur l'ensemble du backend).

#### US-4.3 : Workflow de Clôture Périodique & Verrouillage Immuable des Décomptes (DRAFT ➔ LOCKED ➔ PAID)
- **Statut** : ✅ Implémenté & Validé
- **Origine Le Sage** : Processus formel *Estimation -> Clôture -> Paiement* avec mouvementement irréversible des soldes.
- **Contexte métier** : Séparer clairement la phase de simulation/arbitrage (où l'on peut encore modifier les clés de reversement ou contester une ligne) de la phase de clôture comptable officielle où les chiffres sont gravés dans le marbre, puis de la phase de règlement bancaire effectif.
- **Réalisations** :
  - **Machine à états formelle à 3 paliers** sur `RoyaltyStatement.accounting_status` :
    1. **`DRAFT` (Simulation)** : Calculs en temps réel des quotes-parts, avances et réserves sous-seuil (< 50 €). Modifications de lignes et arbitrages autorisés.
    2. **`LOCKED` (Clôturé & Verrouillé)** : Verrouillage strict des lignes de Grand Livre (`RoyaltyLedgerEntry`), décomptes immuables horodatés et génération automatique d'un **Certificat d'Intégrité numérique avec empreinte SHA-256** scellant les écritures. Possibilité sécurisée de réouverture en simulation (`POST /{id}/reopen-draft`) avec purge automatique du Grand Livre et audit trail.
    3. **`PAID` (Payé & Soldé)** : Enregistrement de l'exécution du règlement bancaire (`POST /{id}/mark-as-paid`) avec saisie de la date, du mode de paiement (Virement SEPA `pain.001`, Virement bancaire, Chèque) et de la référence de transaction. Bascule automatique des écritures `PAYABLE` en `PAID` et interdiction absolue de suppression ou réouverture.
  - **Interface utilisateur Royalties & SACEM** :
    - Bandeau contextuel réactif de pilotage du cycle de vie comptable avec badges d'états ambre, indigo et émeraude.
    - Modale de clôture formelle avec synthèse financière 4 KPIs, validation de la somme de contrôle 100.00 % et avertissement légal.
    - Modale de règlement bancaire avec récapitulatif des montants nets et IBANs des bénéficiaires.
    - Modale du Certificat d'Intégrité affichant le sceau SHA-256 complet copiable en 1 clic et les mentions probatoires (CPI L132-13).
    - Modale de confirmation de réouverture en DRAFT.
  - Suite de tests unitaires dédiée ([`test_statement_lifecycle.py`](file:///Users/ariane/Projects/rights-copilot/backend/tests/test_statement_lifecycle.py), 44/44 tests passants).

#### US-4.4 : Atelier de Diagnostic & Audit Express du Catalogue (Audit 1-clic & Auto-réparation)
- **Statut** : ✅ Implémenté & Validé
- **Origine Le Sage** : *L'Atelier de réparation* (Filtres de contrôle sur les œuvres en anomalie).
- **Contexte métier** : Avant de lancer une déclaration SACEM ou de calculer les décomptes semestriels, l'éditeur doit s'assurer qu'aucune œuvre orpheline ou mal configurée ne subsiste dans son répertoire de 591 œuvres.
- **Réalisations** :
  - Endpoint `GET /api/v1/works/audit` : calcul déterministe du score de santé global (% d'œuvres saines), détection des codes IPI manquants, déséquilibres de clés (!= 100%), co-éditions orphelines, éditeur non contrôlé, codes SACEM/ISWC et cotages manquants.
  - Endpoint `POST /api/v1/works/audit/auto-repair` : moteur de réparation automatique déterministe (injection automatique des codes IPI depuis le Répertoire des Ayants Droit, héritage des contrats depuis les Projets Audiovisuels TF1, et rééquilibrage automatique des micro-écarts d'arrondis des clés à 100.00 % exacts).
  - Bouton interactif « Atelier Diagnostic & Santé » avec badge de score dynamique dans la barre d'outils du Catalogue.
  - Modale complète « Contrôle de Conformité & Atelier de Réparation » avec 4 cartes KPIs, triage par type d'anomalies, tableau haute densité des œuvres en alerte et bouton direct « Inspecter » dans le drawer d'œuvre latéral.
  - Tests automatisés validés (`test_catalog_audit_and_repair.py`, 41/41 tests passants).

#### US-4.5 : Multi-Devises & Table des Parités de Change (USD / GBP / EUR) (✅ Complété)
- **Statut** : ✅ Implémenté & Validé
- **Origine Le Sage** : *Configuration du Sage -> Parités*.
- **Contexte métier** : Les relevés DSP internationaux (ex: Spotify US, YouTube Global, Apple Music) et les décomptes de sociétés étrangères (BMI, ASCAP, PRS) arrivent fréquemment en devises étrangères (USD, GBP, CAD, CHF, JPY, AUD).
- **Réalisations** :
  - **Table des parités de change dans `WorkspaceSettings`** : Taux officiels BCE pivot EUR (EUR, USD, GBP, CAD, CHF, JPY, AUD), stockant `rate_to_eur` (multiplicateur) et `rate_bce` (cotation standard 1 € = X devise) avec endpoints REST complets (`GET /currencies`, `PUT /currencies`, `POST /currencies/reset-bce`, `POST /convert`).
  - **Ingestion multi-devises déterministe** (`POST /api/v1/statements/upload`) : support des paramètres `currency` et `exchange_rate` avec conversion arithmétique `Decimal` stricte au micro-centime (6 décimales) sans dérive de centime.
  - **Traçabilité inviolable au Grand Livre** : `RoyaltyLedgerEntry` enregistre `source_currency`, `exchange_rate` et `source_gross_allocated`.
  - **Décomptes et exports auteurs** : `holder_statement_generator.py`, modale `HolderStatementModal` et relevés CSV/ASCII intégrant la mention légale de conversion, le taux appliqué et le montant d'origine.
  - **Interface utilisateur** :
    - `/settings` : section dédiée 6 « Table des Parités de Change & Multi-Devises », simulateur de conversion en temps réel, modale d'ajustement/ajout et bouton de réinitialisation aux taux BCE.
    - `/reconciliation` : modale d'importation avec sélection de devise et pré-remplissage automatique du cours BCE, badges multi-devises sur les cartes de décompte et affichage du montant brut d'origine sur les lignes de répartition.
  - **Tests automatisés** : suite unitaire dédiée `test_multi_currency.py` (4/4 tests passants, 56/56 tests backend globaux passants).

#### US-4.6 : Options de Présentation Avancées des Décomptes Auteurs (✅ Complété)
- **Origine Le Sage** : *Options d'impression des décomptes* (Subdivision par pays, regroupement par film, décompte en anglais, décompte à zéro).
- **Contexte métier** : Un compositeur de musique de film préfère souvent voir ses redevances regroupées par œuvre et par projet audiovisuel (Série TV / Épisode), avec le détail des exploitations en France vs International.
- **Scope technique Korom** :
  - Options configurables par ayant droit ou lors de l'export des décomptes :
    - Regroupement par **Projet Audiovisuel / Album** (sous-totaux clairs par série TF1 ou album).
    - Sous-totaux par **Zone Géographique / Territoire** (France SACEM vs Reste du Monde).
    - Ventilation par **Famille de droits** (DEP Exécution Publique, DRM Reproduction Mécanique, Droits en Ligne Streaming, Synchronisation).
    - Génération bilingue **Français / Anglais** pour les auteurs et éditeurs internationaux.
    - Option de masquer ou forcer les « décomptes à zéro » pour les créateurs sans activité sur la période.
  - Implémenté sur l'API (`GET /api/v1/statements/{id}/holder-report/{name}` avec `lang`, `group_by`, `hide_zero_lines`), le générateur CSV/ASCII certifié (`printable_text`), la modale interactive d'export et le tableau dynamique avec sous-totaux.

#### US-4.7 : Télétransmission Bancaire SEPA XML ISO 20022 (`pain.001`)
- **Origine Le Sage** : Export pour virements bancaires groupés.
- **Contexte métier** : Pour payer plusieurs dizaines d'ayants droit en une seule opération sans ressaisir manuellement chaque virement sur le portail bancaire professionnel (Qonto, BNP Paribas, Société Générale, CIC).
- **Scope technique Korom** :
  - Génération d'un fichier standard XML conforme à la norme ISO 20022 `pain.001.001.03` (SEPA Credit Transfer).
  - Regroupement des ayants droit ayant le statut `PAYABLE` et un IBAN/BIC valide renseigné dans leur fiche.
  - Prise en charge transparente de la dévolution successorale (US-4.2) avec ventilation distincte par héritier et des mandataires de paiement.
  - Libellé de virement normalisé (ex: `KOROM ROYALTIES 2026-S1 [NOM AYANT DROIT]`).
  - Validation préalable de conformité bancaire (détection immédiate des IBAN invalides ou BIC manquants via algorithme modulo-97 ISO 13616 avant génération).
  - Audit pré-vol 1-clic (`GET /sepa-preview`) et génération du fichier avec somme de contrôle (`POST /export-sepa`).
  - Interface interactive : modale dédiée dans `/reconciliation`, téléchargement direct `.xml`, copie presse-papier, et saisie de l'IBAN/BIC débiteur de l'éditeur dans `/settings`.

---

### 🟣 Priorité 5 — Expérience Utilisateur, Campagnes Consolidées & Roadmap MVP Commercial (Spécifié 📝)

> Cette priorité rassemble les fonctionnalités majeures identifiées lors de l'analyse critique de recul UX et métier. Elle se divise en deux volets indissociables pour un MVP convaincant et commercialisable :
> 1. **Modifier & Améliorer l'existant (US-5.1 à US-5.5)** : lever les ruptures de navigation, éliminer la surcharge cognitive et refactorer l'architecture frontend monolithique.
> 2. **Créer les briques stratégiques manquantes (US-5.6 à US-5.12)** : guider le premier contact sur base vierge, unifier les relevés en campagnes semestrielles consolidées, boucler avec la Sacem (ACK CWR), sécuriser la fiscalité URSSAF et accélérer la diffusion des décomptes.

---

#### 🛠️ Volet A — Modifier & Améliorer l'Existant (Ergonomie, Fluidité & Architecture)

#### US-5.1 : Refonte du Tiroir d'Œuvre (`WorkDetailDrawer`) en Sous-Onglets & Action 1-Clic « Équilibrer le Reste »
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - Extraction et modularisation du composant `WorkDetailDrawer` dans `@/components/catalog/work-detail-drawer.tsx`.
  - Découpage en 4 sous-onglets thématiques lisibles : 1. Identifiants & Métadonnées, 2. Quotes-Parts & Ayants Droit, 3. Contrats & Projets TF1/Albums, 4. Historique, Notes & Audit CWR.
  - Jauges d'équilibre visuelles en temps réel (DEP, DRM, SYNC, PHONO) avec détection d'écarts et contrôle des IPI créateurs.
  - Action 1-clic contextuelle « Équilibrer le reste sur l'éditeur » injectant automatiquement le reliquat exact sans calcul mental pour atteindre 100.00 % émeraude.
  - Bouton de propagation d'héritage contrat cadre TF1 / Album directement depuis l'onglet Projets du tiroir.
- **Contexte & Recul UX** :
  - **Constat** : Le tiroir latéral actuel de consultation et d'édition d'une œuvre déroule verticalement des dizaines de champs (titre, sous-titres, cotage, COCV, ISRC, ISWC, 6 lignes d'ayants droit avec DEP/DRM/SYNC/PHONO, mémo interne, notes de timeline, rattachements aux groupes). Sur un écran portable (13-15"), la charge cognitive est écrasante et oblige à scroller continuellement pour vérifier un IPI tout en éditant les splits. De plus, lorsqu'un split est déséquilibré (ex: 66,66% au lieu de 100%), l'utilisateur doit calculer mentalement le reliquat (33,34%) et le saisir à la main.
  - **Besoin** : Structurer le tiroir en sous-onglets thématiques lisibles et intégrer une action 1-clic pour équilibrer instantanément les quotes-parts.
- **Spécifications fonctionnelles** :
  1. **Navigation interne par sous-onglets dans le Drawer** :
     - **Onglet 1 : Identifiants & Métadonnées** : Titre officiel, sous-titres/alias, genre, Code SACEM (COCV), N° de cotage éditeur, ISWC, ISRC, durée.
     - **Onglet 2 : Quotes-Parts & Ayants Droit** : Tableau des splits (A, C, CA, E, SE) avec jauges d'équilibre en temps réel (100.00 % DEP/DRM/SYNC/PHONO), détection des IPI manquants et statut fiscal.
     - **Onglet 3 : Contrats & Projets Audiovisuels** : Contrats d'édition rattachés (CGP1 / PDF), rattachement aux groupes (Séries TF1, Albums) et bouton de propagation d'héritage.
     - **Onglet 4 : Historique, Notes & Audit CWR** : Timeline chronologique des mémos juridiques/artistiques, rapport d'audit CWR 2.1 détaillé avec libellés CISAC en clair.
  2. **Action 1-clic « Équilibrer le reste sur l'éditeur »** :
     - Bouton contextuel apparaissant dès qu'une clé affiche un écart (ex: DEP à 66.66% -> écart de -33.34%).
     - Un clic injecte automatiquement le différentiel exact sur la ligne Éditeur (ou crée la quote-part éditeur résiduelle si manquante), ramenant la jauge à 100.00% émeraude sans calcul manuel.
- **Impacts techniques** :
  - Extraction du composant `WorkDetailDrawer` depuis `frontend/src/app/catalog/page.tsx` vers `@/components/catalog/work-detail-drawer.tsx`.
  - État React d'onglet actif (`activeTab: 'meta' | 'splits' | 'contracts' | 'history'`).

#### US-5.2 : Passerelle Black Box ➔ Création d'Œuvre 1-Clic & Tri par Montant Brut Décroissant
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - Endpoint backend `POST /api/v1/statements/{id}/lines/{line_id}/create-work-and-match` créant l'œuvre au catalogue, calculant embedding 384d et allocations déterministes, et appariant la ligne orpheline en statut `VALIDATED`.
  - Extension du filtre `sort_by=gross_amount_desc` sur `GET /api/v1/statements/{id}/lines` et tri côté client dans l'interface Réconciliation pour la priorisation Pareto (80/20).
  - Filtre dédié Black Box isolant les flux orphelins sans ISWC/ISRC ou à faible score.
  - Modale interactive `BlackBoxCreateModal` pré-remplie depuis la ligne de relevé (titre, artiste, ISRC) avec autocomplétion des ayants droit et appariement 1-clic.
  - Suite de tests unitaires dédiée dans `backend/tests/test_black_box_gateway.py` (100% passante).
- **Contexte & Recul UX/Métier** :
  - **Constat** : Dans l'onglet Réconciliation, lorsqu'une ligne de relevé DSP (Spotify, Deezer) ou SACEM orpheline arrive sans ISWC ni correspondance catalogue (Black Box), le gestionnaire peut l'apparier manuellement à une œuvre existante. Mais si l'œuvre est nouvelle et absente du catalogue, le flux est brutalement rompu : il doit quitter la page, aller dans `/catalog`, créer l'œuvre de zéro, revenir dans `/reconciliation`, retrouver la ligne et l'apparier. De plus, sur un relevé de 5 000 lignes, les lignes sont affichées dans l'ordre du fichier sans possibilité de trier par montant brut décroissant pour arbitrer en priorité les flux majeurs.
  - **Besoin** : Permettre la création d'œuvre directement depuis la ligne orpheline en pré-remplissant les données, et permettre le tri des flux par valeur financière.
- **Spécifications fonctionnelles** :
  1. **Création d'œuvre 1-clic depuis la ligne orpheline** :
     - Bouton d'action « Créer l'œuvre au catalogue » sur chaque ligne de réconciliation en attente.
     - Ouverture d'une modale compacte pré-remplie avec le titre brut nettoyé, le nom de l'artiste/interprète et l'ISRC extrait de la ligne de relevé.
     - Saisie rapide des ayants droit (avec autocomplétion depuis le Répertoire des ayants droit) et validation créant l'œuvre et appariant immédiatement la ligne en statut `VALIDATED`.
  2. **Tri haute priorité par Montant Brut Décroissant** :
     - Option de tri dans le bandeau de recherche de la Black Box : *Trier par montant décroissant (€)*.
     - Permet d'isoler en tête de liste les lignes représentant 80% de la valeur financière (loi de Pareto) avant de traiter le reliquat de micro-centimes.
- **Impacts techniques** :
  - Endpoint `POST /api/v1/statements/{id}/lines/{line_id}/create-work-and-match`.
  - Extension du filtre `sort_by=gross_amount_desc` sur `GET /api/v1/statements/{id}/lines`.

#### US-5.3 : Dock Flottant Enrichi d'Actions de Masse au Catalogue (Export CWR Groupé & Projets TF1)
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - **Export CWR 2.1 ciblé sur la sélection** :
    - Endpoint backend `GET /api/v1/works/export/cwr?work_ids=...` filtrant déterministement les œuvres sélectionnées, avec nom de fichier contextualisé (`CW26..._SELECTION.V21`) et indicateur `filtered_by_selection`.
    - Bouton vert émeraude 1-clic « Exporter CWR (.V21) » directement sur le dock flottant avec badge d'export et prévisualisation immédiate.
    - Option dédiée « ★ Sélection courante (X œuvres) » intégrée au sélecteur de périmètre de la modale globale d'export CWR.
  - **Rattachement groupé à un Projet Audiovisuel (Série TF1, Film, Album)** :
    - Bouton indigo 1-clic « Rattacher à un Projet » sur le dock flottant ouvrant une modale interactive dédiée `AssignGroupModal`.
    - Sélecteur de projets existants avec type (Série TV, Film, Album), diffuseur (TF1...) et compteur d'œuvres.
    - Option d'héritage automatique du contrat cadre du projet (`inherit_group_contract`) et sélection du mode d'utilisation audiovisuelle pour la cue-sheet (`cue_usage_type`).
    - Exécution déterministe via `batchUpdateWorks`, mise à jour réactive des états catalogue et bannière de confirmation.
  - **Suite de tests automatisée** : nouveau test unitaire d'intégration `test_cwr_export_endpoint_filters_by_work_ids` dans `backend/tests/test_cwr_exporter.py` (80/80 tests backend passants).
- **Contexte & Recul UX** :
  - **Constat** : Le dock flottant d'action en bas d'écran dans le catalogue ne propose actuellement qu'un seul bouton d'action : la suppression groupée (`POST /batch-delete`). Or, le travail quotidien d'un Copyright Manager consiste fréquemment à sélectionner 15 ou 30 œuvres pour les déposer à la Sacem ou les lier à une nouvelle saison de série TV. L'absence d'actions positives sur ce dock limite grandement son utilité.
  - **Besoin** : Transformer le dock de sélection en véritable barre de commande de masse.
- **Spécifications fonctionnelles** :
  1. **Export CWR 2.1 ciblé sur la sélection** :
     - Bouton « Exporter la sélection en CWR (.V21) » sur le dock flottant dès qu'au moins 1 œuvre est cochée.
     - Génère instantanément le fichier de dépôt SACEM restreint aux seules œuvres sélectionnées sans passer par le menu global.
  2. **Rattachement groupé à un Projet Audiovisuel (Série TF1, Film, Album)** :
     - Bouton « Rattacher au groupe... » ouvrant un sélecteur de `WorkGroup` existant ou permettant d'en créer un nouveau en 1 clic.
     - Option d'héritage automatique du contrat cadre et propagation des métadonnées.
- **Impacts techniques** :
  - Enrichissement du composant UI dock flottant dans `frontend/src/app/catalog/page.tsx`.
  - Utilisation de l'endpoint existant `POST /api/v1/cwr/export` avec payload `work_ids: [...]`.

#### US-5.4 : Support Natif des Fichiers Excel SACEM (`.xlsx`) & Mémorisation des Préférences (`localStorage`)
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - **Parsing déterministe des classeurs Excel SACEM (`.xlsx` / `.xlsm`)** :
    - Service autonome `backend/app/services/xlsx_parser.py` conçu avec les bibliothèques standard Python (`zipfile`, `xml.etree.ElementTree`) sans dépendance tierce fragile, ultra-rapide et sécurisé.
    - Extraction automatique des chaînes partagées (`sharedStrings.xml`), conversion en flux CSV délimité et alignement strict des colonnes via conversion de coordonnées de colonnes (`col_ref_to_idx`).
    - Prise en charge transparente dans `POST /api/v1/works/migrate` : détection du header binaire PK zip et de l'extension `.xlsx`, décompression et routage automatique vers le parser SACEM.
  - **Interface utilisateur & Préférences d'affichage** :
    - Modale d'importation du catalogue acceptant indifféremment `.xlsx`, `.xls` et `.csv` par glisser-déposer.
    - Composant `PaginationBar` enrichi avec la prop `storageKey` synchronisant immédiatement tout changement de pagination avec le `localStorage`.
    - Restauration automatique de la densité d'affichage au chargement des pages `/catalog` (`korom_catalog_page_size`) et `/holders` (`korom_holders_page_size`).
  - **Suite de tests automatisée** : tests unitaires dédiés `backend/tests/test_sacem_xlsx_import.py` couvrant la conversion de cellules, l'alignement des colonnes, le mode simulation (dry-run) et l'injection atomique en base avec création d'œuvres et ayants droit (84/84 tests backend passants).
- **Contexte & Recul UX** :
  - **Constat** : L'Espace Membre SACEM propose désormais le téléchargement de son catalogue d'œuvres directement au format Excel `.xlsx` par défaut. Actuellement, l'import Korom n'accepte que les fichiers `.csv`, ce qui oblige l'utilisateur à ouvrir Excel, faire « Enregistrer sous », choisir le séparateur point-virgule et ré-enregistrer, créant un blocage technique pour les juristes non techniques. De plus, la préférence de pagination (ex: 100 lignes par page) est réinitialisée à 50 à chaque rafraîchissement.
  - **Besoin** : Accepter indifféremment `.xlsx` et `.csv` au glisser-déposer, et mémoriser les choix d'affichage utilisateur.
- **Spécifications fonctionnelles** :
  1. **Parsing transparent des fichiers Excel `.xlsx` SACEM** :
     - Détection du type MIME et de l'extension `.xlsx` sur `POST /api/v1/works/import-sacem-csv`.
     - Lecture via `openpyxl` ou `calamine` côté backend, conversion directe en flux tabulaire identique au CSV 17 colonnes sans manipulation externe.
  2. **Persistance des préférences de navigation** :
     - Stockage dans le `localStorage` du navigateur du nombre d'éléments par page sélectionné (`korom_catalog_page_size`, `korom_holders_page_size`).
     - Restauration automatique de la préférence lors des visites ultérieures.
- **Impacts techniques** :
  - Ajout de la dépendance backend `openpyxl` dans `pyproject.toml`.
  - Adaptation de `frontend/src/components/pagination-bar.tsx` pour synchroniser avec `localStorage`.

#### US-5.5 : Découpage Modulaire & Refactoring des Pages Frontend Monolithiques
- **Statut** : 📝 Spécifié / Roadmap MVP
- **Contexte & Recul Technique** :
  - **Constat** : La page `catalog/page.tsx` a atteint **6 921 lignes de code** et `reconciliation/page.tsx` compte **3 702 lignes**, concentrant dans un même fichier l'état global, la logique de fetch, et une dizaine de modales et tiroirs complexes. Cette concentration monolithique fragilise la maintenance, allonge les temps de compilation Next.js et augmente le risque de régressions lors des évolutions.
  - **Besoin** : Découper ces pages maîtresses en sous-composants autonomes et réutilisables au sein de dossiers dédiés.
- **Spécifications fonctionnelles** :
  1. **Arborescence modulaire `@/components/catalog/`** :
     - `work-detail-drawer.tsx` (tiroir d'inspection et édition).
     - `catalog-audit-modal.tsx` (Atelier diagnostic et santé).
     - `cwr-export-modal.tsx` (options avancées de dépôt CWR).
     - `sacem-import-modal.tsx` (ingestion CSV/XLSX).
     - `work-group-manager-modal.tsx` (gestion des séries TF1 et albums).
     - `catalog-floating-dock.tsx` (dock d'actions de masse).
  2. **Arborescence modulaire `@/components/reconciliation/`** :
     - `statement-upload-modal.tsx` (import multi-devises).
     - `sepa-export-modal.tsx` (audit pré-vol et génération ISO 20022).
     - `statement-lifecycle-banner.tsx` (machine à états DRAFT/LOCKED/PAID).
     - `integrity-certificate-modal.tsx` (certificat SHA-256).
- **Impacts techniques** :
  - Refactoring structurel frontend sans modification du comportement métier.
  - Réduction de la taille de chaque page à moins de 600 lignes de code orchestrateur.

---

#### 🚀 Volet B — Nouvelles Fonctionnalités Majeures (Création & Socle MVP Commercial)

#### US-5.6 : Assistant d'Onboarding Interactif & Empty States Guidés (Setup Wizard)
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - **Setup Wizard interactif en 4 étapes** (`frontend/src/components/onboarding-wizard.tsx`) :
    - Étape 1 : Identité Éditeur (vérification nom éditeur, Code IPI 11 chiffres, IBAN/BIC débiteur SEPA avec lien direct vers `/settings`).
    - Étape 2 : Ingestion Catalogue (invitation 1-clic à importer le fichier d'export SACEM `.csv`/`.xlsx`, créant instantanément les œuvres et l'annuaire d'ayants droit).
    - Étape 3 : Liasses & Contrats (invitation à téléverser un premier contrat PDF ou CGP1 avec validation Human-in-the-loop).
    - Étape 4 : Première Simulation Financière (chargement guidé d'un relevé test DSP 100 lignes pour valider la répartition, le seuil de 50 € et le Grand Livre).
    - Barre de progression dynamique, badges d'état « Terminé » / « En attente », panneau rétractable et persistance synchronisée (`WorkspaceSettings` & `localStorage`).
  - **Élimination des faux positifs sur le Dashboard** (`frontend/src/app/page.tsx`) :
    - Remplacement des indicateurs trompeurs ("100 % des œuvres prêtes" et "Tous les contrats sont validés" lorsque la base contient 0 œuvre ou 0 contrat) par des indicateurs d'accueil bienveillants et des boutons d'action rapide vers le wizard ou le chargement de démo.
  - **Refonte des Empty States sur chaque page clé** (`frontend/src/components/empty-state.tsx`) :
    - `/catalog` : carte d'accueil guidée avec import SACEM direct par glisser-déposer, action manuelle et chargement démo.
    - `/holders` : carte d'accueil guidée avec création manuelle, import SACEM et chargement démo.
    - `/contracts` : carte d'accueil guidée avec glisser-déposer de PDF, import CGP1 et chargement démo.
    - `/reconciliation` : carte d'accueil guidée avec chargement direct de relevé test DSP 100 lignes et chargement démo.
  - **Mode Démonstration & Bac à sable réinitialisable** (`backend/app/api/routers/sandbox.py`) :
    - `POST /api/v1/sandbox/load-demo` : injecte 30 œuvres, 3 projets audiovisuels / albums TF1, 9 ayants droit, 4 contrats avec avances, et 1 relevé test DSP 100 lignes.
    - `POST /api/v1/sandbox/reset` : purge intégrale et ordonnée de la base de données (écritures Grand Livre, lignes de relevés, relevés, avances, contrats, groupes, œuvres, répertoire) pour revenir à 100 % vierge.
    - `GET /api/v1/sandbox/status` : diagnostic en temps réel de l'état de la base (compteurs et indicateur `is_empty`).
    - Modale de confirmation sécurisée `ConfirmSandboxResetModal` dans l'interface utilisateur.
  - **Persistance & Schémas** :
    - Extension de `WorkspaceSettings` avec `onboarding_completed`, `onboarding_dismissed`, `onboarding_completed_steps`, migrations incrémentales automatiques et endpoint `POST /api/v1/settings/onboarding`.
  - **Validation & Tests** :
    - Suite complète de tests unitaires et d'intégration validée (`backend/tests/test_sandbox_and_onboarding.py`, 73/73 tests backend passants, 0 régression). Compilation Next.js 14 sans erreur (9/9 pages statiques).

#### US-5.7 : Campagnes de Répartition Multi-Relevés & Clôture Semestrielle Consolidée (Agrégation SACEM + DSP)
- **Statut** : ✅ Implémenté & Validé
- **Contexte & Recul Métier** :
  - Dans la réalité d'un éditeur musical, un exercice de répartition (ex: *1er Semestre 2026*) regroupe **plusieurs relevés de sources différentes** : le décompte semestriel Sacem, les relevés mensuels Spotify, Apple Music, YouTube, sous-édition étrangère.
  - Si un auteur gagne 30 € sur Sacem et 30 € sur Spotify, chaque relevé isolé le classe en `BELOW_THRESHOLD` (< 50 €) et il ne touche rien, alors que son cumul semestriel est de 60 € (> 50 € éligible au virement) !
- **Réalisations** :
  - **Modèle `DistributionCampaign` & Foreign Key sur `RoyaltyStatement`** :
    - Entité SQLModel `DistributionCampaign` avec statut comptable (`DRAFT`, `LOCKED`, `PAID`), horodatage et scellement d'intégrité SHA-256 (`integrity_hash`).
    - Migration incrémentale sur `RoyaltyStatement` (`campaign_id CHAR(32)`).
  - **Moteur d'agrégation multi-relevés & Seuil consolidé (`/api/v1/campaigns`)** :
    - Cumul multi-sources par clé d'identité canonique (`right_holder_id`, `ipi_number`, `nom normalisé`).
    - Application déterministe de l'amortissement d'avance une seule fois par ayant droit sur le cumul global de la période.
    - Application unique du seuil de 50.00 € sur le net cumulé : déblocage automatique en statut `PAYABLE` pour les ayants droit atteignant 50 € grâce au cumul multi-relevés.
    - Scellement immuable de la campagne via signature cryptographique SHA-256 (`POST /campaigns/{id}/lock`) et verrouillage en cascade de tous les relevés rattachés.
    - Télétransmission bancaire consolidée : génération du fichier SEPA XML ISO 20022 (`pain.001.001.03`) pour tous les ayants droit payables de la campagne.
  - **Interface utilisateur React / Next.js 14** :
    - 4e onglet dédié dans la Réconciliation : *Campagnes Multi-Relevés (SACEM + DSP)*.
    - Modale de création et rattachement dynamique des relevés disponibles.
    - Tableau de bord consolidé avec KPI globaux, ventilation par source (badges avec montants par DSP), badge spécial *Seuil débloqué grâce au cumul SACEM + DSP*, sous-tableaux détaillés des œuvres, et modale d'export bancaire SEPA XML.

#### US-5.8 : Ingestion des Accusés de Réception SACEM CWR (Fichiers ACK / NACK) & Suivi des Dépôts
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - **Service d'ingestion & Parsing universel CWR ACK (`cwr_ack_parser.py`)** :
    - Décodeur de fichiers fixes CISAC CWR v2.1/v2.2 ACK (enregistrements `HDR`, `GRH`, `ACK`, `EXC`, `TRL`) et de rapports tabulaires CSV/TSV de dépôts SACEM.
    - Dictionnaire exhaustif des codes d'erreurs et anomalies CISAC (`101`, `104`, `201`, `301`, `401`, `501`...).
    - Matching déterministe en O(1) avec les œuvres du catalogue (COCV SACEM, ISWC, cotage, titre normalisé, code court hex).
  - **Modèle de données & Schémas enrichis** :
    - Champs `sacem_registration_status` (REGISTERED, REJECTED, PENDING_ACK), `sacem_ack_reference`, `sacem_registered_at`, `sacem_rejection_reason` sur le modèle `Work` avec migrations incrémentales automatiques.
    - Enregistrement automatique de notes d'audit horodatées dans la timeline de l'œuvre.
    - Endpoint REST dédié `POST /api/v1/works/import-cwr-ack` acceptant `.ack`, `.v21`, `.csv`, `.txt`, `.xlsx` ou payload brut.
  - **Interface utilisateur** :
    - Composant interactif dédié `frontend/src/components/catalog/cwr-ack-modal.tsx` avec glisser-déposer, mode simulation (dry-run), 4 KPIs synthétiques et tableau complet des transactions.
    - Bouton d'action « Accusé SACEM (ACK) » dans la barre d'outils du catalogue.
    - Badges contextuels `✓ Enregistré SACEM` (émeraude) et `⚠️ Rejet SACEM` (rouge vif animé) sur la table compacte et les cartes du catalogue.
    - Nouveaux filtres rapides par statut : *Enregistrées SACEM* et *Rejets SACEM (NACK)*.
    - Section de suivi officiel SACEM intégrée au tiroir d'œuvre `WorkDetailDrawer` (sous-onglet 1 Métadonnées et sous-onglet 4 Historique).
  - **Tests automatisés** : suite complète de tests unitaires et d'intégration validée (`backend/tests/test_cwr_ack_parser.py`, 88/88 tests passants).
- **Contexte & Recul Métier** :
  - **Constat** : Korom produit des fichiers CWR 2.1 (`.V21`) conformes aux normes CISAC pour le dépôt des œuvres auprès de la Sacem. Cependant, une fois le fichier déposé sur l'extranet Sacem, la société d'auteurs retourne sous 48 à 72h un **fichier d'accusé de réception (ACK/NACK)** confirmant l'enregistrement des œuvres ou notifiant des rejets transactionnels (codes d'erreur CISAC).
  - **Besoin** : Boucler la boucle du Copyright Manager en lui permettant de réimporter le fichier ACK Sacem pour mettre à jour automatiquement le statut des œuvres dans Korom.
- **Spécifications fonctionnelles** :
  1. **Parser officiel de fichiers CWR ACK CISAC** :
     - Lecture des enregistrements ACK (Header HDR, Transaction ACK/NACK, trailer TRL).
     - Détection des transactions acceptées (`ACK` / statut `RA` Registration Accepted) et des rejets (`NACK` / statut `RE` Registration Rejected).
  2. **Synchronisation déterministe avec le Catalogue** :
     - Mise à jour du statut de l'œuvre : `REGISTERED_SACEM` avec horodatage et numéro de dépôt officiel.
     - Extraction et injection automatique du **Code Œuvre SACEM (COCV)** officiel attribué par la Sacem pour les nouvelles œuvres.
     - En cas de rejet : insertion des codes et libellés d'erreurs CISAC officiels dans la fiche de l'œuvre et alerte dans l'inbox d'arbitrage du Dashboard.
  3. **Interface utilisateur** :
     - Bouton « Importer Accusé SACEM (CWR ACK) » dans l'en-tête du Catalogue.
     - Modale de rapport de traitement listant les œuvres confirmées et les erreurs éventuelles.
- **Impacts techniques** :
  - Service backend `cwr_ack_parser.py`.
  - Champs `sacem_registration_status`, `sacem_ack_reference`, `sacem_registered_at` dans le modèle `Work`.

#### US-5.9 : Déclaration Fiscale Récapitulative URSSAF Limousin & Bordereau de Précompte Social
- **Statut** : 📝 Spécifié / Roadmap MVP
- **Contexte & Recul Métier** :
  - **Constat** : Le moteur financier de Korom déduit parfaitement le précompte social Artiste-Auteur (~11,10 % : CSG déductible 6,80%, CSG non déductible 2,40%, CRDS 0,50%, CFP 0,35%, IRCEC RAAP 1,05%) sur les décomptes des créateurs personnes physiques (hors dispense BNC). Cependant, l'éditeur de musique a l'obligation légale de télédéclarer et reverser trimestriellement ces sommes auprès de l'URSSAF Limousin (collecteur officiel du régime des artistes-auteurs).
  - **Besoin** : Générer le bordereau déclaratif officiel récapitulatif pour simplifier la télédéclaration trimestrielle de l'éditeur sur `artistes-auteurs.urssaf.fr`.
- **Spécifications fonctionnelles** :
  1. **Tableau récapitulatif trimestriel du précompte** :
     - Liste de tous les créateurs assujettis ayant perçu des droits sur la période : Nom, Numéro de Sécurité Sociale (NIR), Montant brut HT perçu, Assiette brute majorée (+15% pour frais professionnels), Décomposition ligne par ligne des cotisations retenues (CSG, CRDS, CFP, IRCEC), et Montant de la contribution diffuseur due par l'éditeur (1,10%).
  2. **Formats d'export conformes** :
     - Export CSV au format officiel attendu par le télé-service de l'URSSAF Limousin pour téléversement direct sans ressaisie.
     - Fichier récapitulatif imprimable / PDF certifié pour le dossier comptable de l'éditeur.
- **Impacts techniques** :
  - Endpoint `GET /api/v1/statements/{id}/urssaf-precompte-summary`.
  - Onglet ou modale dédiée dans l'interface de réconciliation / clôture financière.

#### US-5.10 : Recherche Universelle Globale & Navigation Rapide (`Cmd+K` Omnibar)
- **Statut** : ✅ Implémenté & Validé
- **Réalisations** :
  - **Endpoint Backend Unifié (`GET /api/v1/search?q=...`)** :
    - Recherche plein texte multi-entités croisée indexant en temps réel :
      - **Œuvres** : Titres, sous-titres, alias alternatifs, codes ISWC, codes SACEM (COCV), cotages éditeurs, interprètes, et ayants droit dans les splits.
      - **Ayants Droit** : Nom civil, nom d'artiste/commercial, codes IPI, rôles principaux, type d'entité (Personne physique, Société, Succession).
      - **Contrats** : Références contractuelles, cotages, contreparties, éditeurs, programmes audiovisuels, types de contrat et statuts de validation.
      - **Groupes d'œuvres / Projets TF1** : Nom de série, film, album, société de production et cotages associés.
  - **Omnibar Frontend & Palette de Commande (`UniversalSearchModal`)** :
    - Écouteur global de raccourci clavier (`Cmd+K` / `Ctrl+K`) accessible depuis n'importe quel écran.
    - Bouton d'accès rapide avec badge `⌘K` intégré à la barre de navigation principale.
    - Navigation au clavier complète (`↑`, `↓`, `Entrée`, `Échap`) avec mise en surbrillance de l'élément actif.
    - Découpage par catégories avec icônes distinctives, compteurs de résultats, et badges thématiques (CWR prêt, COCV, ISWC, IPI manquant, Validé humain).
    - Navigation en 1 clic vers les écrans cibles avec ouverture automatique du tiroir de détail pour les œuvres (`/catalog?work_id=...`).
    - Suggestions de recherche rapide en état initial vide.
  - **Tests & Robustesse** :
    - Suite de tests unitaires et d'intégration backend `backend/tests/test_universal_search.py` (3/3 validés).
    - 91 tests de régression 100% au vert. Build Next.js 14 validé sans erreur.

#### US-5.11 : Export Groupé ZIP & Diffusion Dématérialisée des Décomptes Auteurs (Emailing & Extranet Auteur)
- **Statut** : 📝 Spécifié / Roadmap MVP
- **Contexte & Recul Métier** :
  - **Constat** : Lorsque le décompte semestriel est verrouillé (`LOCKED`) et payé (`PAID`), l'éditeur doit transmettre à chaque créateur son relevé individuel conforme au CPI L. 132-13. Télécharger les décomptes et notes de droits un par un pour 50 ou 100 auteurs représente plusieurs heures de manipulations répétitives.
  - **Besoin** : Permettre l'export groupé en un clic de l'ensemble des documents de la période, et préparer l'envoi dématérialisé direct aux créateurs.
- **Spécifications fonctionnelles** :
  1. **Archive ZIP consolidée en 1 clic** :
     - Génération côté serveur d'une archive ZIP contenant l'ensemble des décomptes d'auteur (PDF et/ou CSV/ASCII) et factures/notes de droits générées.
     - Arborescence et nommage normalisés : `[PÉRIODE]/[NOM_AYANT_DROIT]_[IPI]/Decompte_[PERIODE]_[NOM].pdf`.
  2. **Module d'envoi d'emails dématérialisés** :
     - Modèle d'email personnalisable avec variables dynamiques (`{nom}`, `{periode}`, `{montant_net}`, `{seuil}`).
     - Envoi individuel avec le décompte en pièce jointe PDF sécurisée vers l'adresse email renseignée dans le Répertoire des Ayants Droit.
     - Journalisation et indicateur de statut dans la table : *Non envoyé*, *Envoyé le JJ/MM/AAAA*, *Erreur de distribution*.
- **Impacts techniques** :
  - Endpoint `GET /api/v1/statements/{id}/export-zip-archive`.
  - Service d'envoi SMTP / API de messagerie (ex: Resend / SendGrid / Postmark).

#### US-5.12 : Générateur & Visualiseur de Cue-Sheets Audiovisuelles (Format SACEM Audiovisuel pour Séries TV / Cinéma)
- **Statut** : 📝 Spécifié / Roadmap MVP
- **Contexte & Recul Métier** :
  - **Constat** : Pour les séries TV quotidiennes (TF1 Production : *Demain Nous Appartient*, *Ici Tout Commence*), téléfilms ou documentaires, les diffuseurs et la Sacem exigent le dépôt formel d'un **Relevé de Diffusion Musicale (Cue-Sheet Audiovisuel)**. Ce document recense chaque passage musical chronologique au sein de l'épisode avec son timecode d'entrée/sortie et son mode d'utilisation.
  - **Besoin** : Offrir aux éditeurs spécialisés en musique à l'image un outil dédié pour gérer, visualiser et exporter des cue-sheets d'épisodes conformes aux exigences du service Audiovisuel de la Sacem.
- **Spécifications fonctionnelles** :
  1. **Gestion des épisodes et cues au sein d'un `WorkGroup`** :
     - Découpage par saison et numéro d'épisode (ex: *DNA Épisode 1845*).
     - Tableau chronologique des cues : Numéro d'ordre (1M01, 1M02...), Titre de l'œuvre au catalogue, Type d'utilisation (Générique début/fin, Musique de fond / Underscore, Thème dramatique, Source visuelle / Radio), Timecode In (`00:12:45:00`), Timecode Out (`00:14:15:00`), Durée calculée (`01:30`).
  2. **Contrôles de cohérence automatique** :
     - Calcul du ratio de musique à l'image : Durée totale musicale / Durée totale du programme.
     - Vérification instantanée que toutes les œuvres de la cue-sheet sont bien répertoriées au catalogue et prêtes pour la Sacem (100% CWR Ready).
  3. **Export officiel Sacem Audiovisuel** :
     - Export du document conforme au gabarit officiel Sacem Cue-Sheet (format Excel `.xlsx` / PDF).
- **Impacts techniques** :
  - Nouveau modèle `AudiovisualCue` rattaché à `WorkGroup` et `Work`.
  - Interface dédiée dans l'onglet Catalogue lors de la sélection d'un projet de type `SERIE_TV` ou `FILM_CINEMA`.

#### US-5.13 : Détection Document AI des Contrats de Co-édition, Sous-groupes d'Œuvres Audiovisuels & Alertes Cession d'Auteurs
- **Statut** : ✅ Implémenté & Validé
- **Contexte & Recul Métier** :
  - Sur les catalogues audiovisuels (TF1), les liasses contractuelles comportent souvent des contrats de co-édition entre plusieurs éditeurs (ex. *Une Musique* + *Éditeur Tiers*). Ces contrats exigent la signature de contrats de cession individuels préalables avec les auteurs/compositeurs. Sans ces cessions, l'éditeur ne dispose pas de la chaîne des droits.
- **Réalisations** :
  - **Extraction Document AI enrichie (`contract_parser.py`)** : Détection des contrats de co-édition (`CO_EDITION`), extraction du programme audiovisuel (`audiovisual_program`), des sous-groupes d'œuvres avec rôles et minutages, et des alertes de cession (`requires_cession_contract`, `expected_cession_contracts`).
  - **Interface Contrats enrichie** : Badges d'alerte orange de co-édition, affichage des contrats de cession attendus et liaison dynamique avec les groupes d'œuvres du catalogue.

#### US-5.14 : Multi-Catalogues & Multi-Entités Éditoriales (Workspace Switcher Kaptain Music / Une Musique)
- **Statut** : ✅ Complété (17/11/2026)
- **Contexte & Recul Métier** :
  - **Constat** : Chez les groupes audiovisuels et les maisons d'édition d'envergure (ex. groupe TF1), deux entités juridiques distinctes gèrent deux catalogues complètement séparés : **KAPTAIN MUSIC** (musique de librairie / illustration sonore) et **UNE MUSIQUE** (génériques, thèmes dramatiques, fictions TV et cinéma). Chacune possède son propre numéro de compte et code IPI société auprès de la SACEM.
  - **Besoin** : Permettre à l'utilisateur de choisir son entité/catalogue dès l'accès à l'application, de créer de nouvelles entités facilement, et de basculer instantanément d'un catalogue à l'autre via un bouton dédié dans la barre de navigation.
- **Réalisations** :
  - **Modèle & Migration de Données (`publishing_entity.py` & `database.py`)** : Création de l'entité `PublishingEntity` (nom, raison sociale, code IPI SACEM, numéro de compte SACEM, code émetteur CWR, couleur, IBAN/BIC) et cloisonnement par colonne indexée `entity_id` sur les tables `Work`, `Contract`, `WorkGroup`, `RoyaltyStatement`, `DashboardTask`.
  - **Seeding Automatique TF1** : Initialisation automatique au démarrage de `KAPTAIN MUSIC` (IPI `00891234567`, entité par défaut préservant les données antérieures) et `UNE MUSIQUE` (IPI `00123456789`).
  - **API REST & Filtrage Déterministe (`entities.py`, `catalog.py`, `contracts.py`, `dashboard_tasks.py`, `royalties.py`)** : CRUD complet `/api/v1/entities`, support du header `X-Entity-Id`, adaptation automatique du CWR `sender_ipi` et `sender_name` en fonction de l'entité active.
  - **Workspace Gateway & Écran d'Accueil (`workspace-gateway.tsx`)** : Écran d'accueil immersif présentant les cartes des catalogues TF1, métriques en temps réel et carte `+ Créer un nouveau profil`.
  - **Workspace Switcher Navbar (`workspace-switcher.tsx` & `navbar.tsx`)** : Sélecteur déroulant intégré à gauche de la barre de recherche `Cmd+K` avec pastille de couleur, affichage du code IPI, switch instantané, modale de création et bouton d'accès à l'écran d'accueil.
  - **Synchronisation Réactive Frontend (`workspace-context.tsx`)** : Diffusion de l'événement `korom_entity_changed` rechargeant instantanément le Dashboard, le Catalogue et les Contrats sans rafraîchir la page.
- **Spécifications fonctionnelles** :
  1. **Page d'accueil & Création d'Entités (Workspace Gateway)** :
     - Écran d'accueil immersif avant le dashboard présentant les profils éditoriaux configurés sous forme de cartes élégantes (avec affichage du nom, code IPI SACEM, logo/pastille de couleur et volume d'œuvres).
     - Profil initial pré-rempli par défaut.
     - Bouton dédié **« + Créer une nouvelle entité »** ouvrant une modale de création : Dénomination sociale (ex: *KAPTAIN MUSIC SAS*), Marque / Nom d'usage (*KAPTAIN MUSIC*), Code IPI Éditeur SACEM (11 chiffres), N° de compte éditeur SACEM, IBAN éditeur, Devise pivot (EUR).
     - Mémorisation du dernier catalogue sélectionné pour reconnexion automatique ou réouverture directe.
  2. **Bouton de bascule rapide dans la Navbar (Workspace Switcher)** :
     - Sélecteur placé immédiatement à gauche de la barre de recherche globale (`Cmd+K`).
     - Menu déroulant avec switch instantané sans perte de contexte de navigation, avec raccourci direct vers « + Ajouter une entité ».
  3. **Cloisonnement étanche des bases de données & exports** :
     - Filtrage/partitionnement automatique des œuvres, contrats, relevés et décomptes selon l'entité active.
     - Paramétrage automatique de l'IPI éditeur et du nom de société émettrice dans les fichiers CWR générés.
- **Impacts techniques** :
  - Modèle `PublishingEntity` (ou `Workspace`) avec identifiants SACEM/IPI.
  - Clé de partitionnement `entity_id` sur les tables principales (`Work`, `Contract`, `RoyaltyStatement`).
  - Context Provider React `WorkspaceContext` et composant `WorkspaceSwitcher` dans la navbar.

#### US-5.15 : Coédition & Gestion des Droits Contrôlés (Perception pour Compte de Tiers / Mandats d'Encaissement)
- **Statut** : ✅ Complété (17/11/2026)
- **Contexte & Recul Métier** :
  - **Constat** : En coédition, le contrat de coédition stipule fréquemment que l'un des coéditeurs est désigné comme **éditeur contrôleur** (ou mandataire d'encaissement). Il perçoit 100 % de la part éditeur auprès de la SACEM ou des DSPs, pour son propre compte et pour le compte des coéditeurs tiers, avec obligation de leur reverser leur quote-part nette semestriellement (décompte de coédition). De même, les auteurs rattachés à un éditeur sont déclarés via les records PWR (Publisher for Writer) dans le CWR.
  - **Besoin** : Indiquer facilement dans la fiche œuvre quel ayant droit ou coéditeur est contrôlé par qui, afin d'automatiser le calcul des décomptes et reversements de coédition.
- **Spécifications fonctionnelles** :
  1. **Indication des droits contrôlés dans la fiche Œuvre (`WorkDetailDrawer`)** :
     - Sur chaque split, affichage clair du badge `🔒 Contrôlé par [Éditeur Mandataire]` vs `👤 Perception directe` avec tooltip explicatif sur la perception pour compte de tiers.
     - Prise en charge des records PWR dans l'import CWR v2.1 pour lier automatiquement les créateurs à l'éditeur déclarant.
  2. **Édition des mandats et contrôles dans la modale d'édition des splits** :
     - Configuration par ayant droit : choix entre « Perception directe (versement direct SACEM/DSPs) » et « Contrôlé par un mandataire (coédition / compte de tiers) ».
     - Sélecteur dynamique pré-rempli avec les éditeurs de l'œuvre ou saisie libre d'un mandataire d'encaissement.
- **Impacts techniques** :
  - Extension du schéma `RightHolderSplit` avec `is_controlled: bool` et `controlled_by_name: str | null`.
  - Parseur CWR v2.1 étendu avec parsing des records PWR et typage des éditeurs SPU (mandataire déclarant) vs OPU.
  - Tests unitaires et d'intégration validés (`test_controlled_copublishing_mandates_and_perception` & `test_cwr_v21_coedition_and_exact_shares_parsing`).

#### US-5.16 : États Métier & Cycle de Vie Éloquent des Œuvres (« À déposer », « Informations manquantes », « Déposé & Exploité »)
- **Statut** : ✅ Complété (16/11/2026)
- **Contexte & Recul Métier** :
  - **Constat** : Les statuts actuels issus des spécifications informatiques (comme *"Conflit CWR"*) sont anxiogènes et ne reflètent pas le cycle de vie métier réel d'une œuvre au sein d'une maison d'édition.
  - **Besoin** : Remplacer les statuts techniques par des états métier explicites et rassurants, compréhensibles immédiatement par l'ensemble des équipes éditoriales et juridiques.
- **Spécifications fonctionnelles** :
  1. **Nomenclature du cycle de vie éditorial** :
     - 🟡 **« À déposer »** : L'œuvre est validée, les quotes-parts sont équilibrées à 100.00 %, tous les créateurs disposent d'un code IPI et le cotage est renseigné. Prête pour le prochain export CWR SACEM.
     - 🔴 **« Informations manquantes »** *(en remplacement de "Conflit CWR")* : L'œuvre nécessite une intervention (ex: IPI manquant sur un auteur, écart de quote-part, rôle non défini). Une infobulle explicite détaille les corrections requises.
     - 🔵 **« Déposé (En attente d'ACK) »** : L'œuvre a été incluse dans un lot CWR envoyé à la SACEM, dans l'attente du fichier d'accusé de réception.
     - 🟢 **« Déposé & Exploité »** : L'œuvre a reçu son accusé d'enregistrement officiel SACEM avec son Code COCV attribué, et génère activement des droits.
     - ⚪ **« Archive / Non administré »** : Œuvre au catalogue non gérée en direct ou sortie de mandat.
  2. **Interface Catalogue & Drawer** :
     - Filtres rapides en 1 clic dans la barre de filtres du Catalogue par état métier.
     - Badges colorés clairs et explicites dans la table et le tiroir latéral.
- **Impacts techniques** :
  - Énumération `WorkLifeCycleStatus` dans `backend/app/schemas/work.py`.
  - Migration de données des anciens libellés vers la nouvelle nomenclature sans régression.

#### US-5.17 : Tableau de Bord Exécutif : Todo List Métier Intelligente & Échéancier Réglementaire SACEM / Sous-Édition
- **Statut** : ✅ Complété (16/11/2026)
- **Contexte & Recul Métier** :
  - **Constat** : À l'ouverture du logiciel le matin, le gestionnaire de droits doit identifier en un clin d'œil les actions urgentes à mener et les prochaines échéances de la profession (dépôts SACEM, réception des relevés, clôtures).
  - **Besoin** : Intégrer sur le Dashboard principal une Todo List métier dynamique combinant alertes automatiques et tâches manuelles personnalisées.
- **Spécifications fonctionnelles** :
  1. **Tâches intelligentes automatisées (Smart Tasks)** :
     - 📤 **CWR à envoyer** : Compteur d'œuvres à l'état *« À déposer »* avec bouton d'accès direct au dock d'export CWR.
     - ⚠️ **Anomalies catalogue** : Nombre d'œuvres avec *« Informations manquantes »* avec lien direct filtré.
     - ⏳ **Accusés SACEM en attente** : Alerte sur les lots CWR transmis sans fichier ACK reçu après 15 jours.
     - 📅 **Compte à rebours répartition SACEM** : Indicateur de la prochaine date officielle de répartition SACEM (Avril, Juillet, Octobre, Janvier).
     - 🌍 **Échéances sous-éditeurs étrangers** : Rappel des dates prévues de réception des décomptes des sous-éditeurs partenaires (configurables dans les paramètres).
  2. **Gestionnaire de tâches manuelles** :
     - Ajout, édition et validation de tâches personnalisées par l'utilisateur (ex: *"Relancer contrat KFC680"*, *"Vérifier dispense URSSAF compositeur X"*).
- **Impacts techniques** :
  - Modèle `DashboardTask` pour les tâches utilisateur manuelles.
  - Endpoint de synthèse `/api/v1/dashboard/todo-summary` agrégeant alertes calculées et tâches manuelles.
  - Widget interactif `DashboardTodoList` sur la page d'accueil (`frontend/src/app/page.tsx`).

#### US-5.18 : Bac à Sable de Comparaison Différentielle SACEM vs Korom & Export Livraison Sous-Édition (CWR & XLSX)
- **Statut** : ✅ Complété (17/11/2026)
- **Contexte & Recul Métier** :
  - **Constat** : Avant de livrer les nouveaux dépôts de titres aux sous-éditeurs à l'étranger (qui représentent le catalogue dans leurs pays respectifs), l'éditeur doit s'assurer que les données déclarées dans Korom sont strictement cohérentes avec les enregistrements officiels de la base SACEM. Les sous-éditeurs réclament ces livraisons régulières au format CWR 2.1 mais également sous la forme de classeurs Excel (`.xlsx`) normés.
  - **Besoin** : Un environnement sécurisé ("sandbox") permettant de comparer l'export du catalogue SACEM avec les œuvres créées sur Korom sur une période donnée, d'enrichir en 1 clic les identifiants officiels SACEM manquants (COCV & ISWC), et d'exporter les titres validés pour les sous-éditeurs.
- **Spécifications fonctionnelles** :
  1. **Atelier de comparaison différentielle (Sandbox Diff Viewer)** :
     - Import d'un export de catalogue SACEM (XLSX, CSV de l'Espace Membre, ou CWR .V21).
     - Rapprochement multi-clés déterministe : COCV, ISWC, puis Titre normalisé.
     - Détection des concordances exactes (`SYNCHRONIZED`), écarts (`DISCREPANCY`), œuvres locales (`KOROM_ONLY`) et œuvres SACEM absentes (`SACEM_ONLY`).
     - Action 1-clic : synchronisation des codes officiels SACEM (COCV & ISWC) sur les fiches Korom sans altérer les quotes-parts.
  2. **Sélection & Livraison Sous-Édition Internationale** :
     - Sélection unitaire ou en masse des œuvres à livrer.
     - **Export Bordereau Excel `.xlsx`** professionnel avec zéro dépendance externe (OpenXML déterministe) contenant l'en-tête de transmission (sous-éditeur, territoire, référence) et le catalogue détaillé des titres et quotes-parts.
     - **Export CWR v2.1** paramétré pour les flux de sous-édition internationale.
- **Impacts techniques** :
  - Module backend `backend/app/services/catalog_comparator.py`.
  - Générateur OpenXML `backend/app/services/xlsx_exporter.py`.
  - Endpoints d'API `/api/v1/subpublishing/compare-sacem`, `/apply-sacem-codes`, `/export-delivery-xlsx`, `/export-delivery-cwr`.
  - Composant frontend réactif `frontend/src/components/catalog/sandbox-diff-viewer.tsx`.

---

## 🧭 Principes Directeurs : Ce que Korom Conserve, Améliore et Évite

| Dimension | Approche Le Sage (Historique) | Approche Korom (Moderne & Épurée) |
| :--- | :--- | :--- |
| **Ergonomie & Interface** | Boîtes de dialogue Windows 95/XP imbriquées, listes figées, modales bloquantes. | Single Page Application réactive (Next.js 14), typographie soignée (Micro), Drawer latéral sans rupture de flux, mode sombre, responsive design. |
| **Réconciliation & Appariement** | Correspondances manuelles lourdes ligne par ligne avec double-clic obligatoire. | Smart Matching automatisé O(1) combinant indexation déterministe (ISWC, Code SACEM, ISRC) et IA sémantique (Fastembed / Levenshtein). |
| **Précision Comptable** | Nombres à virgule flottante classiques sujets à de légers écarts de centimes. | Arithmétique décimale déterministe (`Decimal`) au micro-centime, grand livre comptable immuable et traçabilité inviolable. |
| **Contrôle Sacem / CWR** | Vérification tardive au moment de l'export avec messages d'erreurs bruts. | Jauges d'équilibre visuelles en temps réel (100.00 % DEP/DRM/SYNC/PHONO), détection proactive des codes IPI manquants à chaque frappe. |
| **Gestion du Catalogue** | Saisie manuelle laborieuse ou imports complexes nécessitant un paramétrage préalable. | Import natif 1-clic du fichier Espace Membre SACEM (.csv), normalisation automatique des quotes-parts et synchronisation instantanée du répertoire. |
