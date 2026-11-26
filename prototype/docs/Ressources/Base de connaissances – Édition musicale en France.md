# Base de connaissances : édition musicale en France
Version : 9 novembre 2026. Usage : contexte de référence pour le développement d'un logiciel de gestion des droits d'auteur et des royalties pour éditeurs de musique (projet Antigravity).

> Avertissement : ce document résume des sources officielles (Code de la propriété intellectuelle, Statuts et Règlement général SACEM 2026, Guide de l'éditeur SACEM). Ce n'est pas un avis juridique. Les règles SACEM sont révisées chaque année en assemblée générale : vérifiez la version en vigueur avant de les coder en dur. Chaque règle porte un identifiant `R-xxx`, que le code et les tests peuvent citer.

---

## 0. Glossaire (modèle de données)

| Terme | Définition | Remarque pour le logiciel |
|---|---|---|
| Œuvre | Création musicale avec ou sans paroles | Entité `Work` (ISWC, titre, durée, genre) |
| Auteur (A) | Auteur des paroles | Rôle `A` (CISAC) |
| Compositeur (C) | Auteur de la musique | Rôle `C` ; `CA` = auteur-compositeur |
| Arrangeur (AR) | Arrangement musical | Rôle `AR` |
| Adaptateur (AD) | Adaptation ou traduction du texte | Rôle `AD` |
| Éditeur original (E) | Cessionnaire des droits par contrat de cession et d'édition | Rôle `E` |
| Sous-éditeur (SE) | Représente l'éditeur original sur un territoire | Rôle `SE` |
| Coéditeur | Éditeur qui édite une œuvre avec un autre | Plusieurs `E` sur une même œuvre |
| DEP | Droit d'exécution ou de représentation publique (radio, TV, concert, Internet) | Type de droit `PERF` |
| DR | Droit radio-mécanique : reproduction mécanique par les radios et TV et diffusion de supports enregistrés, copie privée | Type `DR` |
| Phono / DRM | Reproduction mécanique sur phonogrammes et vidéogrammes, téléchargement | Type `MECH` |
| IPI | Identifiant international de l'ayant droit | Clé obligatoire `InterestedParty.ipi` |
| ISWC | Identifiant international de l'œuvre | `Work.iswc` |
| CWR | Common Works Registration, format CISAC de déclaration électronique | Export à prévoir |
| TIS | Territory Information System (norme CISAC TIS09-1540R1a) | Référentiel des territoires |
| Œuvre éditée / inédite | Avec ou sans éditeur déclaré | Change les clés de répartition |

---

## 1. Cadre légal (Code de la propriété intellectuelle)

### 1.1 Règles générales de cession
- **R-001** La cession globale des œuvres futures est nulle ([CPI L131-1](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)).
- **R-002** Les contrats d'édition doivent être écrits ([CPI L131-2](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)).
- **R-003** Chaque droit cédé doit être mentionné séparément. Le domaine d'exploitation doit être délimité par son étendue, sa destination, son lieu et sa durée. La cession du droit d'adaptation audiovisuelle exige un contrat distinct du contrat d'édition ([CPI L131-3](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)).
  → Logiciel : un contrat contient une liste de `GrantedRight{type, territoires, durée, destination}` ; le contrat d'adaptation audiovisuelle est un document séparé.
- **R-004** La rémunération doit être appropriée et proportionnelle aux recettes. Une rémunération forfaitaire n'est possible que dans les cas énumérés, par exemple quand la base de calcul ne peut pas être déterminée ou quand le contrôle coûterait trop cher ([CPI L131-4](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)).
- **R-005** L'auteur peut demander une révision du prix si la lésion dépasse 7/12 en cas de forfait. Il a droit à une rémunération supplémentaire si la rémunération proportionnelle se révèle exagérément faible ([CPI L131-5](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)).
- **R-006 Transparence** : au moins une fois par an, le cessionnaire doit fournir, éventuellement par voie électronique, des informations explicites sur tous les revenus, ventilés par mode d'exploitation, avec la rémunération due pour chacun. Le sous-cessionnaire doit fournir ces informations si le cessionnaire ne l'a pas fait. Cette règle s'applique aux contrats en cours depuis le 7 juin 2022 ([CPI L131-5-1](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)).
- **R-007** En l'absence de toute exploitation, l'auteur ayant cédé des droits exclusifs peut résilier la cession. Pour une œuvre à plusieurs auteurs, la décision se prend d'un commun accord ([CPI L131-5-2](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)).
- **R-008** Une exploitation sous une forme non prévue au contrat exige une clause expresse et une participation aux profits ([CPI L131-6](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)).
- **R-009** Les redevances des trois dernières années bénéficient d'un privilège de créance ([CPI L131-8](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006161639/)).

### 1.2 Contrat d'édition (CPI L132-1 à L132-17)
Source : [Légifrance, section Contrat d'édition](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006179040/2016-08-01).
- **R-010** Définition : l'auteur cède le droit de fabriquer des exemplaires ou de réaliser l'œuvre sous forme numérique. En échange, l'éditeur doit publier et diffuser l'œuvre (L132-1). Les contrats à compte d'auteur et à compte à demi ne sont pas des contrats d'édition (L132-2 et L132-3).
- **R-011 Droit de préférence** (L132-4) : il ne vaut que pour des genres nettement déterminés et se limite, par genre, à **5 œuvres nouvelles** ou à **5 ans** de production. L'éditeur doit répondre par écrit dans les **3 mois** après remise de l'œuvre. Après **2 refus successifs**, l'auteur retrouve sa liberté, mais doit rembourser les avances perçues.
  → Logiciel : compteur d'œuvres et d'échéances, alerte à 3 mois.
- **R-012** Le consentement personnel et écrit de l'auteur est obligatoire (L132-7). L'auteur garantit à l'éditeur l'exercice paisible du droit cédé (L132-8).
- **R-013** Le contrat doit indiquer un premier tirage minimum, sauf s'il prévoit un minimum garanti de droits (L132-10).
- **R-014** L'éditeur ne peut pas modifier l'œuvre sans l'accord écrit de l'auteur et doit mentionner son nom. Pour un contrat à durée déterminée, les droits s'éteignent automatiquement à l'échéance (L132-11).
- **R-015 Exploitation permanente et suivie** et diffusion commerciale conformes aux usages (L132-12). La Cour de cassation l'a rappelé le 5 juin 2024, n° 22-24.462 ([analyse Kohen Avocats](https://kohenavocats.fr/2026/07/29/cession-globale-oeuvres-futures-contrat-edition-musicale-cour-cassation-2026/)).
- **R-016 Reddition des comptes** au moins **annuelle** sauf clause particulière, avec le montant des redevances dues ou versées (L132-13). L'éditeur doit fournir toutes les justifications d'exactitude, sinon le juge peut l'y contraindre (L132-14).
- **R-017** Une procédure de sauvegarde ou de redressement ne résilie pas le contrat. L'auteur peut résilier si l'activité a cessé depuis plus de **3 mois** ou en cas de liquidation (L132-15).
- **R-018** Le contrat ne peut pas être transmis indépendamment du fonds de commerce sans l'autorisation de l'auteur (L132-16). Cela concerne directement les **cessions de catalogue**.
- **R-019** Fin du contrat : destruction de tous les exemplaires, ou absence de publication ou de réédition après mise en demeure (L132-17).

### 1.3 Réforme en cours (à surveiller)
La proposition de loi « relative au contrat d'édition… filières du livre et de l'œuvre musicale » a été adoptée par le Sénat en première lecture le 10 juin 2026, en procédure accélérée ([vie-publique.fr](https://www.vie-publique.fr/dossierlegislatif/JORFDOLE000054234358)). Elle a été transmise à l'Assemblée nationale sous le n° 2916 ([Assemblée nationale](https://www.assemblee-nationale.fr/dyn/17/textes/l17b2916_proposition-loi)). Elle **n'est pas encore en vigueur**. Elle reprend notamment l'accord interprofessionnel du 4 octobre 2017 ([rapport du Sénat n° 694](https://www.senat.fr/rap/l25-694/l25-6941.html)) :
- **R-020 (projet)** Reddition des comptes **par œuvre, au moins semestrielle**, au plus tard **3 mois** après la fin du semestre. Elle peut être électronique ([texte du Sénat](https://www.senat.fr/leg/ppl25-695.html)).
- **R-021 (projet)** Si les comptes ne sont pas rendus, l'auteur peut mettre l'éditeur en demeure. Sans réponse sous 3 mois, la résiliation est automatique. Elle l'est aussi si, sur **3 ans**, les comptes n'ont été rendus qu'après mises en demeure ([rapport du Sénat](https://www.senat.fr/rap/l25-694/l25-6941.html)).
- **R-022 (projet)** Le contrat est résilié de plein droit pour défaut de fabrication ou d'exploitation permanente et suivie si l'éditeur ne régularise pas dans les **3 mois** suivant une mise en demeure par lettre recommandée avec accusé de réception ([rapport du Sénat](https://www.senat.fr/rap/l25-694/l25-6941.html)).
- Un accord interprofessionnel étendu par arrêté devra définir l'exploitation permanente et suivie (promotion, synchronisation, présence en streaming), le droit de préférence, les minimums garantis, le format normalisé des relevés et la médiation. À défaut d'accord sous 18 mois, un décret fixera ces règles ([rapport du Sénat](https://www.senat.fr/rap/l25-694/l25-6941.html)).
→ **Recommandation produit** : concevoir dès maintenant des relevés **semestriels, par œuvre et par mode d'exploitation**, avec un horodatage d'envoi et un suivi des mises en demeure. Le logiciel sera ainsi conforme à R-006, R-016 et au futur R-020.

### 1.4 Code des usages et bonnes pratiques (2017)
Les organisations d'auteurs, de compositeurs et d'éditeurs l'ont signé le 4 octobre 2017 ([ministère de la Culture](https://www.culture.gouv.fr/presse/archives-presse/archives-communiques-de-presse-2012-2018/annee-2017/Francoise-Nyssen-salue-la-signature-du-Code-des-usages-et-bonnes-pratiques-de-l-edition-musicale)). Le texte intégral, en français et en anglais, est disponible sur le site de la [CSDEM](https://csdem.org/les-documents-metier/). **À télécharger et à ajouter à cette base** comme source normative des bonnes pratiques.

---

## 2. Adhésion et obligations de l'éditeur à la SACEM

Sources : [Guide de l'éditeur SACEM](https://www.createursediteurs.sacem.fr/actuimg/fr/live/v4/Createurs-Editeurs/Actualites/2021/2nd_semestre_2021/Guide_editeur_sacem_2021.pdf), [Statuts et Règlement général 2026](https://www.societe.sacem.fr/docs/Statuts_FR_2026.pdf).
- **R-100** Pour être admis, l'éditeur doit avoir édité **4 œuvres** du répertoire et justifier d'un début d'exploitation de chacune. Sont acceptés : streaming, pochette de disque, plateforme vidéo avec **au moins 1 000 vues**, attestation de diffusion (Guide ; RG art. 13).
- **R-101** Pièces à fournir : extrait K-bis de moins de 3 mois ; statuts dont l'objet social mentionne « l'édition musicale » ou « l'édition sous toutes ses formes » ; mandat d'autofacturation (recommandé) (Guide ; RG art. 14 et 16).
- **R-102** Une maison d'édition déclare sous **une seule dénomination**. Un titre de collection est possible avec autorisation (RG art. 44). La SACEM doit valider le nom avant l'adhésion pour éviter les homonymes (Guide).
- **R-103** Un auteur qui s'édite lui-même n'obtient un relevé d'éditeur distinct qu'à partir de **100 œuvres éditées** (RG art. 19).
- **R-104** L'acquéreur d'un fonds n'en devient pas membre automatiquement. Il ne touche que les droits des œuvres du fonds, sauf agrément (RG art. 15, 17 et 18).
- **R-105 TVA** : les droits crédités à un éditeur établi en France sont soumis à la TVA, sauf franchise. L'éditeur en reste responsable, même avec l'autofacturation (Guide).
- **R-106** Les contrats d'édition et de sous-édition doivent stipuler que la SACEM gère les droits qui lui ont été apportés. Une copie certifiée des contrats de sous-édition internationaux doit lui être remise (RG art. 43).
- **R-107 Interdictions** : il est interdit d'associer un diffuseur aux redevances pour obtenir un traitement préférentiel, notamment par une société d'édition affiliée, et de manipuler les programmes (Statuts art. 10, 11 et 11 bis ; RG art. 29).

## 3. Déclaration des œuvres

- **R-200** La déclaration est obligatoire et doit précéder l'exécution ou la reproduction. Elle est la base de la répartition (RG art. 38). Les œuvres éditées doivent être déclarées avant toute diffusion, en particulier pour le numérique (Guide).
- **R-201** Le bulletin doit correspondre **strictement** au contrat de cession et d'édition, notamment pour les parts de chacun (Guide). Il doit **totaliser 100 %** ([CSDEM](https://csdem.org/les-documents-metier/)).
  → Validation bloquante dans le logiciel : la somme des parts par type de droit doit être égale à 100 % (voir l'annexe JSON).
- **R-202** Pour être payée à une répartition, la déclaration doit arriver **au moins 65 jours avant** le paiement, sinon elle passe à la répartition suivante (RG art. 45).
- **R-203** La déclaration est faite en ligne pour la chanson, le jazz, l'électro, la musique illustrative, l'instrumental, etc. Le bulletin papier reste obligatoire pour les arrangements, adaptations, musiques de film, publicités, œuvres classiques contemporaines (Guide).
- **R-204** Le format **CWR** est accepté pour les œuvres éditées et pour la sous-édition générale ou d'option, après obtention d'un code contrat (contact : depot.sous.edition@sacem.fr) ([Guide SACEM Luxembourg](https://www.sacem.lu/media/301111bc-44f3-482c-a875-1676800e7d24/guide-editeur.pdf) ; Guide).
- **R-205** Le contrat de coédition doit être joint à la déclaration d'une œuvre coéditée. Une déclaration partielle est possible dans certains cas (Guide).
- **R-206 Audiovisuel** : la cue-sheet doit être déclarée au plus tard **1 mois après la première diffusion** (Règlement de l'audiovisuel, art. 3 et 4).
- **R-207** Les programmes de concerts se déclarent jusqu'à 6 mois avant et 6 mois après la date du spectacle (Guide).
- **R-208** Le titre d'une adaptation doit différer de celui de l'œuvre originale. Pour un arrangement, il faut préciser la destination : « toutes destinations » ou une exploitation précise (Guide).

## 4. Clés de répartition (cœur du moteur de calcul)

Sources : [SACEM, répartition](https://www.createursediteurs.sacem.fr/sacem-et-moi/repartition-droits-auteur), [Statuts 2026](https://www.societe.sacem.fr/docs/Statuts_FR_2026.pdf), [Guide de l'éditeur](https://www.createursediteurs.sacem.fr/actuimg/fr/live/v4/Createurs-Editeurs/Actualites/2021/2nd_semestre_2021/Guide_editeur_sacem_2021.pdf).

### 4.1 Entre catégories d'ayants droit
| Droit | Auteurs | Compositeurs | Éditeurs | Nature |
|---|---|---|---|---|
| DEP, œuvre éditée (R-300) | 1/3 | 1/3 | 1/3 | Statutaire, fixe (Statuts art. 9 ; RG art. 57) |
| DEP, œuvre inédite (R-301) | 1/2 | 1/2 | — | RG art. 58 |
| DR, œuvre éditée (R-302) | 25 % | 25 % | 50 % | Statutaire. Si la clé phono est plus favorable aux créateurs, elle s'applique (Statuts art. 9) |
| DR, œuvre inédite | 50 % | 50 % | — | S'applique aussi à la copie privée |
| Phono / DRM (R-303) | Contrat | Contrat | Contrat | Contractuel, indiqué sur le bulletin. Aucun plafond SACEM pour l'édition originale |

- **R-304** Une œuvre seulement littéraire ou seulement musicale : l'auteur seul ou le compositeur seul reçoit les deux parts créateurs (RG art. 59).
- **R-305** Un auteur ou compositeur qui s'édite lui-même peut toucher la part éditeur (RG art. 61).
- **R-306** Œuvre étrangère sous-éditée : la part éditeur en DEP ne peut pas dépasser **50 % du total** (RG art. 60). Pour les droits venant de l'étranger, les créateurs peuvent « participer à l'effort de sous-édition », ce qui fait passer la part éditoriale de 33,33 % à 50 % (Guide).
- **R-307** Sous-édition phono : la part du sous-éditeur peut aller **jusqu'à 100 %** si la société des ayants droit l'autorise ou en cas d'avance. Le contrat doit préciser si l'avance est récupérée sur la part éditoriale ou sur 100 % des droits (Guide).

### 4.2 Au sein d'une catégorie
- **R-310** Par défaut, les parts DEP et DR sont **égales** au sein de chaque catégorie. On peut choisir de suivre le partage phono sans modifier les parts entre catégories (Guide ; RG art. 57 et 76).
- **R-311** Les éditeurs peuvent répartir leur part DEP de trois façons : à parts égales, selon le partage phono, ou de manière inégale sans suivre le phono. Cette option ne vaut que pour les œuvres déclarées **depuis le 1er janvier 2019** (Guide).

### 4.3 DEP avec arrangeurs et adaptateurs (RG art. 66 à 70 bis)
| Cas | A orig. | AD | C orig. | AR | E |
|---|---|---|---|---|---|
| Adaptation, paroles et musique, éditée | 2/12 | 2/12 | 4/12 | — | 4/12 |
| Adaptation, paroles et musique, inédite | 4/12 | 2/12 | 6/12 | — | — |
| Adaptation d'un texte seul, édité | 6/12 | 2/12 | — | — | 4/12 |
| Arrangement, musique sans paroles, éditée | — | — | 7/12 | 1/12 | 4/12 |
| Arrangement, musique sans paroles, inédite | — | — | 11/12 | 1/12 | — |
| Idem, film ou symphonique, éditée | — | — | 6/12 | 2/12 | 4/12 |
| Arrangement, paroles et musique, éditée | 7/24 | — | 7/24 | 2/24 | 8/24 |
| Arrangement, paroles et musique, inédite | 11/24 | — | 11/24 | 2/24 | — |
| Idem, film ou symphonique, éditée | 6/24 | — | 6/24 | 4/24 | 8/24 |
| Adaptation et arrangement, éditée | 3/24 | 4/24 | 7/24 | 2/24 | 8/24 |
| Adaptation et arrangement, inédite, non symphonique | 7/24 | 4/24 | 11/24 | 2/24 | — |

### 4.4 Barème DR (RG art. 76 : œuvres protégées)
| Cas | A | C | E | AR | AD |
|---|---|---|---|---|---|
| Paroles et musique, éditée | 25 | 25 | 50 | — | — |
| + arrangement | 21,875 | 21,875 | 50 | 6,25 | — |
| + adaptation | 18,75 | 18,75 | 50 | — | 12,5 |
| + arrangement et adaptation | 15,625 | 15,625 | 50 | 6,25 | 12,5 |
| Paroles et musique, inédite | 50 | 50 | — | — | — |
| + arrangement / + adaptation / + les deux | 46,875 / 43,75 / 40,625 | idem | — | 6,25 | 12,5 |
| Musique seule, éditée (+ arrangement) | — | 50 (43,75) | 50 | (6,25) | — |
| Musique seule, inédite (+ arrangement) | — | 100 (93,75) | — | (6,25) | — |
| Texte seul, édité (+ adaptation) | 50 (37,5) | — | 50 | — | (12,5) |
| Texte seul, inédit (+ adaptation) | 100 (87,5) | — | — | — | (12,5) |

Pour un arrangement sur une musique de film ou une œuvre symphonique protégée, la part de l'arrangeur passe à **12,5 %**. Elle est prise sur le compositeur, ou pour moitié sur l'auteur et pour moitié sur le compositeur si l'œuvre a des paroles.
L'article 77 couvre le **domaine public** : l'éditeur reçoit 50 % et l'arrangeur ou l'adaptateur le reste (100 % s'il n'y a pas d'éditeur). Le détail est dans le fichier JSON.

### 4.5 Cas particuliers
- **R-320 Œuvres dramatiques** (fragments relevant de la SACD) : part éditoriale de 1/3. Sans convention communiquée dans les 3 mois, la répartition est 1/3 / 1/3 / 1/3, avec 20 % de la part auteur réservés au librettiste et 20 % de la part compositeur à l'arrangeur (RG art. 54).
- **R-321 Vidéographie** : 20 % pour les auteurs-réalisateurs, hors télévision et câble. Les œuvres préexistantes sont réparties au prorata du temps (RG art. 62).
- **R-322 Cinéma en salle** : 18 % vont aux courts métrages ; les textes de doublage et de sous-titrage reçoivent 3/24 (Règlement de l'audiovisuel, art. 9 et 10).

## 5. Versements, réclamations, prescription

- **R-400** Le délai entre collecte et versement va de **3 à 12 mois** selon l'exploitation. La SACEM verse **jusqu'à 4 fois par an**, avec un détail œuvre par œuvre et par origine. La prochaine répartition est le 6 janvier 2027 ([SACEM](https://www.createursediteurs.sacem.fr/sacem-et-moi/repartition-droits-auteur)).
- **R-401** Les rappels après réclamation ne remontent qu'à **5 ans** après la perception (RG art. 81).
- **R-402** Les redevances créditées mais non réclamées pendant **5 ans** après la répartition sont acquises à la SACEM (Statuts art. 8 ; RG art. 84).
  → Logiciel : alerte sur les droits non rapprochés et les œuvres non déclarées avant la limite de 5 ans.
- **R-403** La SACEM répond aux contestations administratives sous **2 mois** (RG art. 32 bis).
- **R-404** Retenue maximale pour frais sur le DR : **20 %** des perceptions brutes (Statuts art. 9).

## 6. Sous-édition et coédition

- **R-500** Trois types de contrats : **général** (tout le catalogue, y compris les œuvres futures pendant la durée), **particulier** (liste d'œuvres, territoires et durée déterminés, au moins une œuvre déposée) et **d'option** (œuvres déposées au fil de l'eau) (Guide).
- **R-501** Le contrat doit être déposé **dès la signature et avant toute œuvre**. Il doit indiquer la date, le cédant et le cessionnaire avec leur raison sociale et leur IPI, les territoires TIS et les pourcentages collectés par type de droit (contact : depot.contrat@sacem.fr) (Guide).
- **R-502** Un éditeur original fiscalement domicilié en France ne peut pas céder les **territoires SACEM** : France métropolitaine, Outre-mer, Monaco, Luxembourg, Liban (Guide).
- **R-503** En fin de contrat, il faut fournir le numéro du contrat, la date de fin, l'éventuelle **période de collection** et la liste des œuvres conservées (Guide).
- **R-504** Le contrat de coédition doit préciser le territoire, la durée, le partage phono, DR et DEP conforme au RG, ainsi que l'éditeur habilité à gérer et à signer les sous-éditions (Guide ; RG art. 44).

## 7. Contrat de cession et d'édition : contenu minimal (checklist)
Sources : CPI et Guide.
1. Identité précise des parties et IPI.
2. Œuvre(s) : titre, ISWC et rôles. La cession globale d'œuvres futures est interdite (R-001).
3. Liste distincte des droits cédés (R-003) : reproduction graphique, phono, numérique, synchronisation, etc. Mention de la réserve des droits apportés à la SACEM (R-106).
4. Territoires et durée.
5. Rémunération proportionnelle par mode d'exploitation : phono, synchronisation, graphique, numérique, sous-édition (R-004). Clé phono reportée sur le bulletin (R-201).
6. Éventuelles avances ou minimum garanti, et mode de récupération (R-307).
7. Préférence éventuelle conforme à R-011.
8. Engagement d'exploitation permanente et suivie (R-015).
9. Modalités de reddition des comptes : annuelle au minimum aujourd'hui, semestrielle prévue (R-016, R-020).
10. Contrat d'adaptation audiovisuelle sur un **document séparé** (R-003).
11. Clauses de résiliation (R-007, R-017, R-019, R-022).

## 8. Exigences fonctionnelles dérivées pour le logiciel
| ID | Exigence | Règles |
|---|---|---|
| F-01 | Référentiel des ayants droit avec IPI, rôle CISAC, société d'appartenance, statut TVA | R-101, R-105 |
| F-02 | Fiche œuvre avec ISWC, statut éditée ou inédite, type (paroles et musique, musique seule, texte seul), arrangement et adaptation, domaine public | §4 |
| F-03 | Moteur de clés : application automatique des barèmes DEP et DR selon le type d'œuvre ; clé phono contractuelle ; contrôle que le total fait 100 % | R-201, R-300 à R-311 |
| F-04 | Contrats avec droits, territoires TIS, durée, échéances, préférence (compteur 5 œuvres / 5 ans) | R-003, R-011, R-500 |
| F-05 | Sous-édition : pourcentages collectés par territoire et par droit, période de collection, avances | R-306, R-307, R-501, R-503 |
| F-06 | Export CWR et bulletins ; alerte « déclaration à faire au moins 65 jours avant la répartition » | R-202, R-204 |
| F-07 | Import des relevés SACEM et des sous-éditeurs, rapprochement œuvre par œuvre, réclamations dans la limite de 5 ans | R-400 à R-402 |
| F-08 | Relevés aux auteurs par œuvre et par mode d'exploitation, semestriels et électroniques, avec preuve d'envoi | R-006, R-016, R-020 |
| F-09 | Suivi de l'exploitation (streaming, synchronisation, promotion) comme preuve d'exploitation permanente et suivie ; journal des mises en demeure avec compteurs de 3 mois | R-015, R-021, R-022 |
| F-10 | Cession de catalogue : contrôle de l'autorisation des auteurs si la cession est séparée du fonds | R-018, R-104 |
| F-11 | Gestion des avances et de leur récupération, TVA, autofacturation | R-105, R-307 |
| F-12 | Versionnage des barèmes, car le RG SACEM change chaque année | Toutes |

## 9. Points à compléter
- Texte intégral du Code des usages 2017 ([CSDEM](https://csdem.org/les-documents-metier/)).
- Règles de répartition détaillées de la SACEM, notamment le calendrier et les règles du numérique (document « Règles des répartitions » sur l'espace membre).
- Taux contractuels d'usage (graphique, synchronisation, numérique) : il n'existe pas de barème légal, ils sont à fixer par contrat.
- Suivi de la proposition de loi n° 2916 à l'Assemblée nationale.
- Règles SACEM sur les cue-sheets et la musique de librairie (production music).
