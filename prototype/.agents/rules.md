# Korom — Règles Métier, Légales, Statutaires SACEM & Architecture

Ce document constitue la **source de vérité normative** pour tous les développements de **Korom** (KOpyright & ROyalties Manager).
Il synthétise le cadre légal impératif (Code de la propriété intellectuelle), les Statuts et Règlement général de la SACEM (version 2026), le Guide de l'éditeur SACEM, et l'architecture technique du logiciel. Chaque règle porte son identifiant officiel `R-xxx` ou `F-xx` pour traçabilité dans les tests et le code.

---

## 1. Stack Technique & Architecture

- **Monorepo** :
  - `backend/` : Python 3.12+, FastAPI, SQLModel / SQLAlchemy, Pydantic v2, pytest.
  - `frontend/` : Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React.
  - `scripts/` : Scripts d'automatisation, benchmarks et génération du suivi (`generate_feature_tracking.py`).
- **Matching & Vectoriel** : Fastembed (modèle `BAAI/bge-small-en-v1.5` ou multilingue) avec similarité cosinus déterministe et pondération hybride lexicale/vectorielle.
- **Identité Visuelle & Typographie** :
  - Nom du logiciel : **Korom** (KOpyright & ROyalties Manager).
  - Baseline : *Copyrights & Royalties* (en italique).
  - Police officielle : **Micro** (Bold, SemiBold, Regular).
  - Palette : Violet de marque `#8067DC`, violet sombre `#745DCA`, lilas pastel `#EFEAFF`.

---

## 2. Principes Fondamentaux d'Intégrité Financière & IA

1. **Calculs financiers 100 % déterministes** :
   - **JAMAIS de calcul de redevance, de split, d'arrondi ou de montant financier par un LLM.**
   - Tous les calculs s'exécutent en code Python déterministe avec le type `Decimal` (précision minimale de 6 décimales pour les micro-flux streaming DSP).
   - Algorithme de Hare-Niemeyer (**Méthode du Plus Fort Reste / Largest Remainder Method**) obligatoire pour garantir que la somme des parts réparties égale **au centime près** le brut perçu, sans biais d'arrondi.
2. **Rôle exclusif de l'IA (Human-in-the-loop)** :
   - L'IA intervient uniquement pour :
     1. Le parsing de contrats PDF scannés / textuels vers un schéma Pydantic strict.
     2. L'extraction assistée des métadonnées de relevés et le matching d'alias / fuzzy matching vectoriel.
   - Tout résultat IA est assorti d'un score de confiance (`0.0` à `1.0`), d'un statut `PENDING_REVIEW` et requiert une **validation humaine formelle**.
3. **Grand Livre Immuable (Audit Trail)** :
   - Tout relevé validé est verrouillé avec le statut `LOCKED`.
   - Les écritures générées dans `RoyaltyLedgerEntry` sont infalsifiables et immuables.
   - Toute modification de configuration ou d'arbitrage est tracée dans `AuditLog`.

---

## 3. Modèle de Données Métier & Identifiants Internationaux

| Terme | Entité / Champ | Remarque & Norme |
|---|---|---|
| **Œuvre** | `Work` | Clé internationale obligatoire `iswc` (`T-XXX.XXX.XXX-C`), titre, sous-titre, durée, genre, splits. |
| **Auteur (A)** | Rôle `A` | Rôle CISAC pour l'auteur des paroles. |
| **Compositeur (C)** | Rôle `C` | Rôle CISAC pour l'auteur de la musique. `AC` / `CA` = Auteur-Compositeur. |
| **Arrangeur (AR)** | Rôle `AR` | Rôle CISAC pour l'arrangement musical d'une œuvre protégée ou du domaine public. |
| **Adaptateur (AD)** | Rôle `AD` | Rôle CISAC pour l'adaptation ou la traduction du texte. |
| **Éditeur original (E)** | Rôle `E` | Cessionnaire des droits d'édition par contrat de cession. |
| **Sous-éditeur (SE)** | Rôle `SE` | Représentant de l'éditeur sur un territoire étranger par contrat de sous-édition. |
| **Producteur Phono (P)** | Rôle `P` | Titulaire des droits phonographiques (Master). |
| **Artiste-Interprète (I)** | Rôle `I` | Titulaire des droits voisins phonographiques. |
| **IPI** | `RightHolder.ipi_number` | Identifiant international de l'ayant droit (9 à 11 chiffres). Obligatoire pour CWR / Sacem. |
| **ISRC** | `Work.isrc_codes` | Code international d'enregistrement sonore (`CC-XXX-YY-NNNNN`). |
| **CWR** | Export CWR v2.1 | Format Common Works Registration (norme CISAC / Sacem). |
| **TIS** | Territoires | Norme CISAC TIS09-1540R1a pour la codification des territoires. |

---

## 4. Cadre Légal Impératif (Code de la Propriété Intellectuelle)

- **R-001** : **La cession globale des œuvres futures est nulle d'ordre public** ([CPI L131-1](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)). Tout contrat prétendant céder l'universalité de la production future d'un auteur sans limitation doit être rejeté ou signalé en anomalie bloquante.
- **R-002** : **Contrat écrit obligatoire** pour tout contrat d'édition ([CPI L131-2](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)).
- **R-003** : **Mention distincte de chaque droit cédé** délimité par son étendue, sa destination, son territoire et sa durée. **La cession du droit d'adaptation audiovisuelle exige obligatoirement un contrat distinct** du contrat d'édition ([CPI L131-3](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)).
- **R-004 & R-005** : Rémunération obligatoirement appropriée et proportionnelle aux recettes ([CPI L131-4](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)). Action en révision si lésion > 7/12 en cas de forfait ([CPI L131-5](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)).
- **R-006, R-016 & R-020** : **Transparence et reddition des comptes** :
  - L'éditeur doit rendre compte au moins **une fois par an** (CPI L132-13) avec détail des revenus ventilés par mode d'exploitation et par œuvre (CPI L131-5-1).
  - Évolution réglementaire (proposition de loi n° 2916 & accord interprofessionnel CSDEM 2017) : reddition **semestrielle, par œuvre et par mode d'exploitation**, au plus tard **3 mois** après la fin du semestre (R-020).
- **R-011** : **Pacte de préférence** ([CPI L132-4](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006179040/2016-08-01)) :
  - Strictement limité à **5 œuvres nouvelles** par genre ou à **5 années** de production.
  - L'éditeur dispose d'un délai impératif de **3 mois** pour répondre par écrit après remise de l'œuvre.
  - Après **2 refus successifs**, l'auteur est délié de plein droit de son engagement.
- **R-015** : **Obligation d'exploitation permanente et suivie** conforme aux usages (Cass. 5 juin 2024, n° 22-24.462 ; CPI L132-12). Résiliation automatique en cas de défaut persistant 3 mois après mise en demeure (R-022).
- **R-018** : **Cession de catalogue** : Le contrat d'édition ne peut pas être transmis séparément du fonds de commerce sans l'autorisation préalable et expresse de l'auteur ([CPI L132-16](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006179040/2016-08-01)).
- **R-502** : **Territoires SACEM inaliénables** : Un éditeur original établi en France **ne peut pas céder** à un sous-éditeur étranger les territoires d'apport exclusif à la SACEM : **France métropolitaine, Outre-mer, Monaco, Luxembourg, Liban**.

---

## 5. Clés de Répartition SACEM (Statuts & Règlement Général 2026)

### 5.1 Règle Fondamentale de Balance à 100 % (R-201)
Le bulletin de déclaration et le catalogue doivent correspondre strictement au contrat de cession. **Pour chaque famille de droits (DEP, DR, SYNC, PHONO), la somme exacte des parts doit totaliser 100.00 %** au centime près.

### 5.2 Clés entre Catégories d'Ayants Droit
| Type de Droit | Auteurs (A) | Compositeurs (C) | Éditeurs (E) | Nature de la Règle |
|---|---|---|---|---|
| **DEP — Œuvre éditée (R-300)** | **1/3** (33,33333 %) | **1/3** (33,33333 %) | **1/3** (33,33333 %) | **Statutaire, fixe** (Statuts art. 9 ; RG art. 57). Si Auteur-Compositeur unique : 2/3 AC / 1/3 E. |
| **DEP — Œuvre inédite (R-301)** | 1/2 (50,00 %) | 1/2 (50,00 %) | — | RG art. 58. Si Auteur-Compositeur unique : 100 % AC. |
| **DR — Œuvre éditée (R-302)** | **25,00 %** | **25,00 %** | **50,00 %** | Statutaire (RG art. 76). Si la clé phono contractuelle est plus favorable aux créateurs, elle s'applique (Statuts art. 9). |
| **DR — Œuvre inédite** | 50,00 % | 50,00 % | — | S'applique également à la copie privée. |
| **PHONO / DRM (R-303)** | Contractuel | Contractuel | Contractuel | 100 % contractuel fixé dans le contrat de cession. Aucun plafond Sacem pour l'édition originale. |

- **R-304** : Œuvre musicale seule (instrumentale) ou littéraire seule : le créateur unique perçoit les deux parts créateurs (ex: en DEP éditée, C = 2/3 et E = 1/3).
- **R-306** : **Sous-édition d'œuvres étrangères** : La part du sous-éditeur en DEP est plafonnée à **50.00 % au maximum** (RG art. 60). Pour les droits en provenance de l'étranger, les créateurs peuvent participer à l'effort de sous-édition portant la part éditoriale de 33,33 % à 50,00 %.
- **R-307** : **Sous-édition Phono** : La part du sous-éditeur peut aller jusqu'à 100 % si expressément autorisé ou pour amortissement d'une avance contractuelle.

### 5.3 Barèmes DEP avec Arrangeurs et Adaptateurs (RG art. 66 à 70 bis)
| Configuration de l'Œuvre | Auteur orig. | Adaptateur (AD) | Compositeur orig. | Arrangeur (AR) | Éditeur (E) |
|---|---|---|---|---|---|
| **Adaptation P+M, éditée** | 2/12 (16,67 %) | 2/12 (16,67 %) | 4/12 (33,33 %) | — | 4/12 (33,33 %) |
| **Adaptation P+M, inédite** | 4/12 (33,33 %) | 2/12 (16,67 %) | 6/12 (50,00 %) | — | — |
| **Adaptation Texte seul, éditée** | 6/12 (50,00 %) | 2/12 (16,67 %) | — | — | 4/12 (33,33 %) |
| **Arrangement Musique seule, éditée** | — | — | 7/12 (58,33 %) | 1/12 (8,33 %) | 4/12 (33,33 %) |
| **Arrangement Musique seule, inédite** | — | — | 11/12 (91,67 %) | 1/12 (8,33 %) | — |
| **Arrangement Musique film/symph., éditée** | — | — | 6/12 (50,00 %) | 2/12 (16,67 %) | 4/12 (33,33 %) |
| **Arrangement P+M, éditée** | 7/24 (29,17 %) | — | 7/24 (29,17 %) | 2/24 (8,33 %) | 8/24 (33,33 %) |
| **Arrangement P+M, film/symph., éditée** | 6/24 (25,00 %) | — | 6/24 (25,00 %) | 4/24 (16,67 %) | 8/24 (33,33 %) |
| **Adaptation & Arrangement, éditée** | 3/24 (12,50 %) | 4/24 (16,67 %) | 7/24 (29,17 %) | 2/24 (8,33 %) | 8/24 (33,33 %) |

### 5.4 Barème DR pour Œuvres Protégées (RG art. 76)
- **Paroles et musique éditée standard** : A = 25 %, C = 25 %, E = 50 %.
- **+ arrangement** : A = 21,875 %, C = 21,875 %, AR = 6,25 %, E = 50 %.
- **+ adaptation** : A = 18,75 %, C = 18,75 %, AD = 12,5 %, E = 50 %.
- **+ arrangement et adaptation** : A = 15,625 %, C = 15,625 %, AR = 6,25 %, AD = 12,5 %, E = 50 %.
- **Film ou symphonique protégée** : part de l'arrangeur portée à **12,5 %** (au détriment des compositeurs/auteurs, part éditeur restant à 50 %).

### 5.5 Domaine Public (RG art. 77)
Lorsqu'une œuvre du domaine public fait l'objet d'un arrangement ou d'une adaptation éditée :
- **L'Éditeur perçoit 50,00 %**.
- **L'Arrangeur (AR) ou l'Adaptateur (AD) perçoit les 50,00 % restants** (ou 25 % AR / 25 % AD si les deux interviennent).
- Sans éditeur, l'arrangeur ou l'adaptateur perçoit 100 %.

### 5.6 Répartition Intra-Catégorie (R-310, R-311)
- Par défaut, les parts sont égales entre créateurs d'une même catégorie (ex: 2 auteurs se partagent la part Auteur à 50/50).
- Option : suivre les quotes-parts contractuelles fixées dans le partage phono.
- Pour les coéditeurs (œuvres déclarées depuis le 01/01/2019) : 3 modes au choix (parts égales, partage phono, ou clé libre inégale).

---

## 6. Délais Opérationnels & Prescription Légale

- **R-202** : **Délai de déclaration CWR** : La déclaration d'une œuvre doit parvenir à la SACEM **au moins 65 jours avant** la date de paiement de la répartition concernée. À défaut, la répartition est décalée au trimestre suivant.
- **R-206** : **Audiovisuel & Cue-sheets** : La cue-sheet (feuille de montage musical) doit être déposée auprès de la SACEM au plus tard **1 mois après la première diffusion**.
- **R-401** : **Prescription des réclamations** : Les réclamations et demandes de rappels de droits ne peuvent porter que sur les perceptions des **5 dernières années**.
- **R-402** : **Redevances non réclamées** : Les redevances créditées mais non réclamées pendant **5 ans** après la répartition sont définitivement acquises à la SACEM (Statuts art. 8 ; RG art. 84). Le logiciel doit lever des alertes préventives sur les droits non rapprochés approchant cette échéance.

---

## 7. Fiscalité, Statuts Sociaux & Facturation (R-101, R-105, F-01)

- **TVA des éditeurs français (R-105)** : Les redevances créditées à un éditeur établi en France sont soumises à la TVA (sauf régime de la franchise en base art. 293 B du CGI). L'éditeur reste responsable de sa déclaration de TVA même en cas de mandat d'autofacturation délivré à la SACEM.
- **Régimes des ayants droit créateurs** :
  - **Personne Physique (Artiste-Auteur)** : Soumis par défaut au **Précompte Social Auteur** (CSG/CRDS, vieillesse plafonnée, formation professionnelle IRCEC / URSSAF Limousin, soit ~11,10 % brut) retenu à la source par l'éditeur, **sauf** si l'auteur fournit une **attestation annuelle de dispense de précompte URSSAF** (statut BNC avec numéro SIRET).
  - **Société (Personne Morale)** : Facturation directe avec numéro SIRET, n° de TVA intracommunautaire, conforme au standard Factur-X / Chorus Pro.
  - **Coordonnées Bancaires** : Tout virement de solde net après amortissement d'avance exige un IBAN / BIC validé.

---

## 8. Checklist d'Implémentation & Tests Automatisés

Toute nouvelle fonctionnalité ou modification du code doit respecter :
1. ✅ **Test de non-régression déterministe** : Aucun montant flottant `float` pour les calculs de redevances ; utilisation exclusive de `Decimal`.
2. ✅ **Validation CWR bloquante** : Somme DEP = 100,00 %, Somme DRM = 100,00 %, vérification IPI (9 à 11 chiffres) et format ISWC (`T-XXX.XXX.XXX-C`).
3. ✅ **Contrôle du plafond DEP éditeur** : Part statutaire originale fixée à 33,33 % (1/3) ; part jusqu'à 50,00 % autorisée uniquement si sous-édition étrangère (R-306) ou accord contractuel explicite.
4. ✅ **Détection des clauses d'ordre public CPI** : Rejet des cessions d'œuvres futures sans objet délimité (R-001) et vérification du contrat d'adaptation audiovisuelle distinct (R-003).
5. ✅ **Gestion du droit de préférence (R-011)** : Compteur 5 œuvres / 5 ans et alerte de réponse écrite sous 3 mois.
6. ✅ **Relevés conformes R-006 & R-020** : Relevé semestriel par ayant droit, détaillé œuvre par œuvre et ventilé par mode d'exploitation (DEP, DR, Phono, Synchronisation).
