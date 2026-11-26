#!/usr/bin/env python3
"""Générateur des fichiers de suivi des fonctionnalités (Markdown .md, Excel .xlsx, CSV .csv)

Ce script analyse l'ensemble des développements réalisés sur RightsCopilot et produit :
1. FEATURES_TRACKING.md : tableau Markdown directement visualisable sur GitHub et dans l'IDE.
2. FEATURES_TRACKING.xlsx : classeur Excel natif avec colonnes formatées, styles et liens cliquables.
3. FEATURES_TRACKING.csv : format tabulaire standard UTF-8 (BOM).
"""

import csv
import io
import os
import zipfile
from xml.sax.saxutils import escape

DATA = [
    {
        "date": "2026-11-05",
        "feature": "Architecture Fondatrice & Socle MVP RightsCopilot",
        "description": (
            "Mise en place de l'application complète RightsCopilot : "
            "1) Catalogue d'œuvres avec moteur de validation CWR (règles Sacem / Cisac : sommes DEP/DRM = 100%, "
            "part éditeur ≤ 50% sans co-éditeur, unicité rôle/IPI). "
            "2) Export conforme Cisac CWR 2.1 / 2.2. "
            "3) Module d'ingestion & migration de catalogues historiques (formats Le Sage / Improvize). "
            "4) Répertoire & Annuaire des Ayants Droit (statuts fiscaux : Artiste-Auteur précompte IRCEC/URSSAF, "
            "BNC avec dispense, Sociétés avec Factur-X TVA ; coordonnées bancaires IBAN/BIC). "
            "5) Module d'extraction IA de contrats PDF (OpenRouter / Claude-3.5-Sonnet avec fallback regex déterministe) "
            "et workflow Human-in-the-loop (statut PENDING_REVIEW, score de confiance). "
            "6) Réconciliation financière et matching intelligent de relevés CSV (DSP Spotify/Apple Music, Sacem) "
            "avec approche hybride textuelle et vectorielle."
        ),
        "tech_stack": (
            "FastAPI, Python 3.12+, SQLModel, SQLite / PostgreSQL (pgvector), "
            "Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React, "
            "pypdf, httpx, fastembed"
        ),
        "github_hash": "7a4072b",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/7a4072b",
    },
    {
        "date": "2026-11-05",
        "feature": "Résolution des 3 Red Flags Métier & Sécurité Financière",
        "description": (
            "Résolution des 3 défis critiques de gestion des droits musicaux : "
            "1) Red Flag #1 (Arrondis & micro-centimes) : Moteur de répartition en Decimal strict (6 décimales) "
            "pour les flux streaming micro-DSP (< 0,005 €) et algorithme du plus fort reste (Largest Remainder Method) "
            "garantissant que la somme des parts distribuées égale au centime près le brut perçu sans distorsion. "
            "2) Red Flag #2 (Grand Livre Immuable) : Verrouillage comptable (statut LOCKED) des relevés de redevances "
            "avec écritures infalsifiables dans RoyaltyLedgerEntry. "
            "3) Red Flag #3 (Performance de Réconciliation) : Optimisation du matching par lot en O(1) via "
            "indexation mémoire et déduplication des lignes de relevés répétées."
        ),
        "tech_stack": "Python (Decimal), SQLModel, FastAPI, SQLite / PostgreSQL",
        "github_hash": "21a96ea",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/21a96ea",
    },
    {
        "date": "2026-11-05",
        "feature": "Pipeline Intégré Contrats ➔ Ayants Droit ➔ Facturation Automatisée",
        "description": (
            "Interconnexion automatique du pipeline métier : "
            "1) La validation humaine d'un contrat extrait crée ou met à jour la fiche ayant droit correspondante. "
            "2) Après verrouillage comptable des royalties (LOCKED), génération automatique de notes de droits d'auteur "
            "pour artistes-auteurs (déduction précompte social URSSAF ~10%, IRCEC ~1,10%, TVA 10%) ou de factures pour "
            "sociétés d'édition (Factur-X, TVA 20%, mentions légales obligatoires) prêtes à l'emploi, téléchargeables "
            "et imprimables."
        ),
        "tech_stack": "FastAPI, SQLModel, ReportLab (PDF), Next.js 14, TypeScript, Tailwind CSS",
        "github_hash": "7cfef49",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/7cfef49",
    },
    {
        "date": "2026-11-05",
        "feature": "Stress-Test Benchmark 5 000 Lignes & Performance DSP",
        "description": (
            "Création d'un jeu de données synthétique haute volumétrie de 5 000 lignes de relevés streaming "
            "(Spotify, Apple Music, Deezer) et ajout d'un bouton de test 1-clic dans l'onglet Réconciliation pour "
            "valider la robustesse, la scalabilité et la vélocité du moteur de matching en conditions réelles."
        ),
        "tech_stack": "Python, Next.js, TypeScript, CSV Streaming",
        "github_hash": "59ec4e3",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/59ec4e3",
    },
    {
        "date": "2026-11-05",
        "feature": "Script de Lancement Automatisé (start_poc.sh) & Documentation Démo",
        "description": (
            "Création du script bash autonome start_poc.sh pour un déploiement local en un clic : "
            "vérification des prérequis système (Python, Node), création des environnements virtuels, initialisation "
            "de la base de données SQLite locale et lancement simultané de FastAPI (:8000) et Next.js (:3000). "
            "Rédaction complète du guide de démonstration et des cas d'usage dans le README."
        ),
        "tech_stack": "Bash (Zsh/Bash), Python venv, Uvicorn, npm, Next.js",
        "github_hash": "76979e4",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/76979e4",
    },
    {
        "date": "2026-11-05",
        "feature": "Fiche Œuvre Détaillée, Tiroir Latéral (Drawer) & Timeline d'Annotations",
        "description": (
            "Conception d'un panneau latéral coulissant (Slide-over Drawer) permettant d'inspecter et modifier les détails "
            "d'une œuvre sans quitter le catalogue : sous-titre officiel Sacem, alias / titres alternatifs, codes ISRC/ISWC, "
            "mémo interne éditeur et historique chronologique d'annotations horodatées (Timeline Notes) pour le suivi "
            "des événements juridiques et artistiques."
        ),
        "tech_stack": "React, Next.js 14, Tailwind CSS, Lucide React, FastAPI, SQLModel",
        "github_hash": "ac8e33b",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/ac8e33b",
    },
    {
        "date": "2026-11-05",
        "feature": "Projets Audiovisuels (TF1), Albums & Modifications par Lot (Batch)",
        "description": (
            "Structuration du catalogue en projets audiovisuels (Films, Séries TV type TF1 Production, Documentaires, Publicités) "
            "et Albums musicaux (WorkGroup). Fonctionnalité de sélection multiple au catalogue et modifications par lot : "
            "rattachement groupé à un projet, mise à jour en masse des statuts ou annotations, et ciblage précis d'un ayant "
            "droit dans un lot d'œuvres pour modifier ses quotes-parts (DEP, DRM, SYNC, PHONO) ou son rôle sans altérer "
            "les parts des co-auteurs."
        ),
        "tech_stack": "SQLModel, FastAPI, PostgreSQL / SQLite, Next.js 14, TypeScript, Tailwind CSS",
        "github_hash": "5983a39",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/5983a39",
    },
    {
        "date": "2026-11-07",
        "feature": "Ingestion Liasses Multi-Contrats Anglais (TF1/Kaptain) & Référence Cotage",
        "description": (
            "Prise en charge des liasses contractuelles complexes en anglais (Kaptain Music / UNE MUSIQUE) combinant "
            "un contrat de cession d'édition, une annexe droits voisins/master (redevance artistes-interprètes de 20% divisée au "
            "prorata) et un acte d'adaptation audiovisuelle selon l'art. L. 131-3 CPI. Extraction prioritaire du numéro de cotage / "
            "référence interne (ex: KFC576-01) distinct du numéro d'enregistrement et affichage dans le catalogue."
        ),
        "tech_stack": "Python (pypdf), OpenRouter AI (Claude-3.5-Sonnet), regex déterministe, FastAPI, Next.js",
        "github_hash": "04a746a",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/04a746a",
    },
    {
        "date": "2026-11-07",
        "feature": "Édition Complète des Données Extraites & Clés Synchro / Phono",
        "description": (
            "Possibilité d'éditer manuellement dans l'onglet Contrats l'ensemble des données extraites avant validation : "
            "cotage / référence interne, titres d'œuvres, noms d'ayants droit, codes IPI et rôles. Affichage et saisie des clés "
            "de répartition Synchronisation (SYNC) et Droits Voisins / Master (PHONO) en complément des parts DEP et DRM Sacem. "
            "Distinction stricte entre titre principal et sous-titre."
        ),
        "tech_stack": "React, TypeScript, Next.js 14, FastAPI, Pydantic v2, SQLModel",
        "github_hash": "c304bb7",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/c304bb7",
    },
    {
        "date": "2026-11-07",
        "feature": "Synthèse Ciblée des Clauses Financières & Citations Verbatim",
        "description": (
            "Remplacement de la retranscription brute de la première page du contrat par une synthèse structurée des clauses "
            "financières ayant déterminé les répartitions (Œuvre & Cotage, Cession Sacem, Droits Voisins Annexe 1, Synchronisation, "
            "Avance). Affichage des citations verbatim exactes du contrat PDF pour chaque ayant droit identifié."
        ),
        "tech_stack": "OpenRouter AI Prompt Engineering, FastAPI, React, Tailwind CSS",
        "github_hash": "bf69ddc",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/bf69ddc",
    },
    {
        "date": "2026-11-07",
        "feature": "Détection & Extraction Multi-Œuvres (Tableaux & Listes Ligne par Ligne)",
        "description": (
            "Capacité d'extraire simultanément toutes les œuvres cédées au sein d'un même contrat (ex: contrat KFC674 contenant "
            "4 œuvres), qu'elles soient listées dans un tableau multi-colonnes (Title, Subtitle, Song, Recording N°) ou sous forme "
            "de liste non structurée avec retours à la ligne ou puces. Interface enrichie avec zone de saisie multi-lignes et "
            "prévisualisation par badges individuels 🎵."
        ),
        "tech_stack": "Regex multilignes & parsers tabulaires Python, Prompt LLM multi-titres, Next.js 14, Tailwind CSS",
        "github_hash": "9783a44",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/9783a44",
    },
    {
        "date": "2026-11-07",
        "feature": "Suppression Sécurisée avec Modale de Confirmation (Catalogue, Ayants Droit, Contrats)",
        "description": (
            "Ajout d'une modale de confirmation réutilisable (ConfirmDeleteModal) avec avertissement explicite et affichage du nom "
            "de l'élément ciblé pour éviter toute suppression involontaire. "
            "1) Suppression d'œuvres dans le catalogue avec cascade sur les liens de groupes (WorkGroupLink). "
            "2) Suppression d'ayants droit dans le répertoire avec découplage propre des clés étrangères dans les contrats et "
            "registres d'avances (intégrité référentielle). "
            "3) Suppression de contrats dans l'onglet Contrats avec purge des comptes d'avances récupérables (AdvanceLedger) "
            "et découplage du grand livre comptable. "
            "4) Neutralisation du prompt système IA contre les hallucinations d'ayants droit. "
            "5) Suite de tests unitaires dédiée (test_deletion_endpoints.py)."
        ),
        "tech_stack": "FastAPI (endpoints DELETE RESTful HTTP 204), SQLModel, React / Next.js 14, Lucide React, Tailwind CSS, Pytest/Unittest",
        "github_hash": "0423c44",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/0423c44",
    },
    {
        "date": "2026-11-09",
        "feature": "Rebranding « Korom » (KOpyright & ROyalties Manager) & Intégration Police Micro",
        "description": (
            "Refonte de l'identité visuelle du frontend : "
            "1) Renommage officiel du logiciel en « Korom » (KOpyright & ROyalties Manager) et mise à jour du sous-titre "
            "en « Copyrights & Royalties » dans l'en-tête de navigation. "
            "2) Intégration de la police de caractères géométrique Micro (Superior Type, design Marek Pístora) "
            "au format WOFF2 pour le nom du logiciel et le titre épuré « Tableau de bord » (suppression de l'ancien sous-titre). "
            "3) Configuration Next.js (localFont) et utilitaire Tailwind CSS (font-micro)."
        ),
        "tech_stack": "Next.js 14 (localFont), Tailwind CSS, WOFF2 (Superior Type Micro), TypeScript",
        "github_hash": "27ac4a4",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/27ac4a4",
    },
    {
        "date": "2026-11-09",
        "feature": "Agrandissement Navbar (+10pt hauteur, +6pt texte) & Titre Centré (+12pt)",
        "description": (
            "Ajustement typographique et proportionnel de l'interface : "
            "1) Rehaussement de la barre de navigation de +10 pt (hauteur ~68px) et agrandissement du texte de +6 pt "
            "sur l'ensemble des éléments du bandeau (Korom à 26px, baseline à 17px, onglets de navigation à 18px avec icônes adaptées). "
            "2) Titre « Tableau de bord » centré horizontalement sur sa ligne en haut de la page et agrandi de +12 pt "
            "(taille 40px en typographie Micro)."
        ),
        "tech_stack": "Next.js 14, Tailwind CSS, Typographie Micro, TypeScript",
        "github_hash": "090206f",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/090206f",
    },
    {
        "date": "2026-11-09",
        "feature": "Ajustement Typographique Navbar (-3pt sur les textes)",
        "description": (
            "Rééquilibrage de la taille des textes de la barre de navigation (-3 pt / -4px) pour un rendu épuré et équilibré : "
            "nom Korom ajusté à 22px, baseline Copyrights & Royalties à 13px, onglets à 14px (avec icônes 16px) "
            "tout en maintenant la hauteur rehaussée de la barre (~68px)."
        ),
        "tech_stack": "Next.js 14, Tailwind CSS, TypeScript",
        "github_hash": "c6e4f19",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/c6e4f19",
    },
    {
        "date": "2026-11-09",
        "feature": "Refonte Dashboard en Cockpit d'Arbitrage Juridique & Priorités Métier",
        "description": (
            "Transformation du Dashboard en cockpit opérationnel pour gestionnaires de copyright : "
            "1) Bloc d'inbox d'arbitrage en 3 priorités immédiates (contrats à valider en revue humaine, conflits CWR "
            "bloquants pour la Sacem, lignes de streaming/relevés orphelines Black Box). "
            "2) Barre d'actions rapides (déposer contrat PDF, déclarer œuvre, annuaire ayants droit, rapprocher relevé). "
            "3) 4 indicateurs métier haute densité (taux de conformité Sacem %, contrats & cotages, solde d'avances non amorties, "
            "Grand Livre verrouillé). "
            "4) Synthèse des projets audiovisuels actifs (Séries TV TF1, Films, Albums)."
        ),
        "tech_stack": "React, Next.js 14, Tailwind CSS, Typographie Micro, TypeScript",
        "github_hash": "4b71a0a",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/4b71a0a",
    },
    {
        "date": "2026-11-09",
        "feature": "Jauges d'Équilibre des Clés (100% Sacem) & Filtres Métier Catalogue",
        "description": (
            "Refonte métier du Catalogue d'œuvres (Étape 2) pour gestionnaires de copyright : "
            "1) Jauges visuelles d'équilibre des clés de répartition (DEP %, DRM %, SYNC %, PHONO %) : pastilles vert émeraude à 100.00 % "
            "ou alertes rose vif avec détection de l'écart (+/- %) pour anticiper les rejets Sacem CWR. "
            "2) Barre de distribution visuelle des ayants droit (créateurs vs éditeurs) et détection instantanée des codes IPI manquants (bloquant Sacem). "
            "3) Triage rapide métier en 6 filtres : Toutes, Prêtes CWR, Conflits Clés != 100%, IPI Manquant, Co/Sous-édition, Mémos & Litiges. "
            "4) Recherche multi-critères étendue au cotage contrat (KFC674-01...), IPI, ayant droit, ISWC, ISRC, projets TF1. "
            "5) Navigation croisée fluide avec le Dashboard (liens directs vers les conflits ou vers un projet audiovisuel via query params)."
        ),
        "tech_stack": "React, Next.js 14, Tailwind CSS, Typographie Micro, TypeScript",
        "github_hash": "d9d7ff7",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/d9d7ff7",
    },
    {
        "date": "2026-11-09",
        "feature": "Revue Contractuelle Human-in-the-Loop, Presets Sacem & Triage des Contrats",
        "description": (
            "Refonte de la gestion contractuelle et du répertoire des ayants droit (Étape 3) : "
            "1) Barre d'outils de préréglages Sacem en 1 clic pour l'édition des clés : Cession Sacem 50/50 (50% Éditeur / 50% Créateurs) "
            "et Équilibrage automatique du solde restant pour garantir 100.00 % DEP/DRM. "
            "2) Jauges visuelles d'équilibre déterministe (DEP, DRM, SYNC, PHONO) dans le total des contrats avec calcul de l'écart. "
            "3) Détection et surbrillance des codes IPI manquants sur les ayants droit du contrat (prévention des rejets de déclaration). "
            "4) Triage et recherche rapide des contrats par statut (Tous, À auditer, Validés, Rejetés) et multi-critères (Cotage KFC674, cocontractant, titre). "
            "5) Modernisation typographique Micro sur la Liasse contractuelle et le Répertoire des ayants droit."
        ),
        "tech_stack": "React, Next.js 14, Tailwind CSS, Typographie Micro, TypeScript",
        "github_hash": "06f963a",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/06f963a",
    },
    {
        "date": "2026-11-09",
        "feature": "Cockpit de Réconciliation Financière DSP, KPIs & Triage Black Box",
        "description": (
            "Modernisation de l'onglet Réconciliation & DSP pour gestionnaires de royalties : "
            "1) 4 Piliers financiers du relevé : Total Brut Déclaré, Brut Rapproché & Validé (%), En Attente / Black Box (€), "
            "et Statut Grand Livre (LOCKED immuable vs DRAFT). "
            "2) Triage rapide et recherche de flux par statut (Toutes, À arbitrer, Validées, Black Box orpheline sans ISWC/ISRC) "
            "et par scores de confiance IA (≥ 90%, 65%–89%, < 65%). "
            "3) Badges visuels de méthode d'appariement (EXACT_ISWC, VECTEUR IA Fastembed, ALIAS MÉMORISÉ, LEXICAL). "
            "4) Recherche multi-critères instantanée sur les lignes (titre brut, œuvre catalogue, ISWC, ISRC, interprète, type de droit). "
            "5) Modernisation du bandeau et des actions en typographie Micro."
        ),
        "tech_stack": "React, Next.js 14, Tailwind CSS, Typographie Micro, TypeScript",
        "github_hash": "5d37f60",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/5d37f60",
    },
    {
        "date": "2026-11-09",
        "feature": "Intégration du Logo Korom (K), Déclinaisons de Marque & Harmonisation Visuelle",
        "description": (
            "Déploiement complet de la nouvelle identité visuelle Korom (KOpyright & ROyalties Manager) : "
            "1) Remplacement du bouclier générique dans la Navbar par le logo officiel « K » en police Micro Bold (#8067DC). "
            "2) Intégration des alternatives de la charte graphique : logo complet avec baseline en italique (#745DCA), "
            "variante typographique échelonnée KoRoM et trigramme KRM. "
            "3) Harmonisation de la palette globale de l'application sur le violet officiel #8067DC, lilas #EFEAFF "
            "et accent sombre #745DCA pour les boutons, badges et jauges d'équilibre. "
            "4) Mise à jour de la police de la Navbar et alignement de tous les titres principaux des onglets "
            "en Micro Bold avec badges thématiques uniformes. "
            "5) Composants React réutilisables, fichiers vectoriels SVG haute résolution et favicon SVG natif."
        ),
        "tech_stack": "React, Next.js 14, Tailwind CSS, SVG, Typographie Micro, TypeScript",
        "github_hash": "bc0b3c2",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/bc0b3c2",
    },
    {
        "date": "2026-11-09",
        "feature": "Conformité Cadre Légal CPI & Barèmes Statutaires SACEM 2026 (.agents/rules.md)",
        "description": (
            "Alignement exhaustif du socle Korom sur le cadre juridique de l'édition musicale française "
            "(Code de la propriété intellectuelle) et les Statuts & Règlement général SACEM 2026 : "
            "1) Mise à jour majeure de .agents/rules.md intégrant les règles d'ordre public CPI (R-001 nullité de cession "
            "d'œuvres futures, R-003 acte audiovisuel séparé, R-011 droit de préférence max 5 œuvres / 5 ans et alerte 3 mois, "
            "R-015 exploitation permanente et suivie, R-502 inaliénabilité des territoires SACEM pour éditeurs français). "
            "2) Intégration des barèmes officiels de répartition SACEM (R-300 DEP statutaire 1/3 créateurs / 1/3 éditeur, "
            "R-302 DR 25% A / 25% C / 50% E, R-306 plafond sous-édition 50% DEP, et matrices d'adaptations/arrangements). "
            "3) Support des rôles CISAC complets avec ajout de AD (Adaptateur) et AR (Arrangeur) dans RightHolderRole et CWR 2.1. "
            "4) Enrichissement du validateur CWR avec avertissements préventifs Sacem R-300/R-306 et nouveaux presets statutaires."
        ),
        "tech_stack": "Python, SQLModel, Pydantic v2, CWR 2.1, CISAC, TypeScript, Next.js 14",
        "github_hash": "3ca3a4f",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/3ca3a4f",
    },
    {
        "date": "2026-11-09",
        "feature": "Suppression Groupée Sécurisée & Dock d'Action Flottant (Catalogue, Ayants-droit, Contrats)",
        "description": (
            "Implémentation complète de la suppression multi-éléments avec confirmation et audit trail dans les 3 bases fondamentales : "
            "1) Barre d'action flottante ergonomique (dock bas d'écran semi-transparent avec compteur d'éléments sélectionnés, "
            "bouton poubelle rouge et action tout désélectionner). "
            "2) Modale de confirmation réutilisable et sécurisée listant nommément les éléments ciblés et avertissant de l'irréversibilité. "
            "3) Onglet Catalogue : suppression par lot d'œuvres (POST /api/v1/works/batch-delete) avec nettoyage en cascade des "
            "ayants droit rattachés, notes, métadonnées et journalisation d'audit. "
            "4) Onglet Ayants-droit : suppression par lot (POST /api/v1/holders/batch-delete) avec découplage relationnel intègre "
            "des contrats et comptes d'avances sans destruction orpheline. "
            "5) Onglet Contrats : suppression par lot (POST /api/v1/contracts/batch-delete) avec désactivation des comptes d'avances "
            "associés et préservation des œuvres au catalogue. "
            "6) Boutons 'Tout sélectionner' et cases à cocher contextuelles réactives sur les cartes et tableaux. Suite de tests automated pytest."
        ),
        "tech_stack": "FastAPI, SQLModel, SQLAlchemy, Next.js 14, Tailwind CSS, Pytest",
        "github_hash": "b881f96",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/b881f96",
    },
    {
        "date": "2026-11-09",
        "feature": "Refonte Complète du Workflow Royalties & Décomptes SACEM (Bilan Ayants Droit, Ventilation par Œuvre, Factures/Notes de Droits 1-Clic)",
        "description": (
            "Refonte intégrale de l'expérience et du moteur de traitement des décomptes SACEM : "
            "1) Bilan d'encaissement et de répartition par ayant droit sur le décompte/trimestre sélectionné avec 4 KPI cards "
            "(Total Brut SACEM, Assiette HT Nette, Amortissement Avances, Net à Payer). "
            "2) Ventilation granulaire par œuvre sous chaque ayant droit (accordéon dépliable : code ISWC, rôle, droit DEP/DRM, "
            "montant brut, part % et montant réparti). "
            "3) Moteur financier strict selon le statut juridique : déduction automatique du précompte social Artiste-Auteur "
            "(CSG/CRDS + IRCEC/CFP ~11,10 %) pour Personne Physique (sauf dispense BNC), gestion TVA (10 %/20 %) et SIRET pour Sociétés. "
            "4) Génération 1-clic du Décompte d'Auteur conforme CPI L132-13 avec export CSV et impression formatée. "
            "5) Génération 1-clic de la Facture / Note de Droits d'Auteur prête à l'emploi (mentions légales CPI, mandat d'autofacturation, "
            "modalités Factur-X). "
            "6) Navigation unifiée avec 3 sous-vues réactives (Bilan par Ayant Droit, Rapprochement Œuvres & Catalogue, Ingestion Relevés) "
            "et renommage de l'onglet en 'Royalties & SACEM'."
        ),
        "tech_stack": "FastAPI, SQLModel, Decimal, Next.js 14, TypeScript, Tailwind CSS, Lucide React, Pytest",
        "github_hash": "e60fd7c",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/e60fd7c",
    },
    {
        "date": "2026-11-10",
        "feature": "Code SACEM (COCV), N° de Cotage, Smart Matching Déterministe & Backlog Produit",
        "description": (
            "Implémentation de la Priorité 1 issue de l'analyse comparative critique du logiciel Le Sage : "
            "1) Création du fichier BACKLOG.md de gestion de projet répertoriant les 4 niveaux de priorités, epics et user stories. "
            "2) Modèle de données Œuvre enrichi avec le Code Œuvre SACEM (COCV à 10-11 chiffres) et le N° de Cotage éditorial/librairie. "
            "3) Moteur de Smart Matching optimisé en O(1) avec indexation par Code SACEM (EXACT_SACEM_CODE) prioritaire sur les codes ISRC. "
            "4) Interface Catalogue : affichage badges SACEM et Cotage dans la vue table haute densité et la vue cartes. "
            "5) Tiroir latéral (Drawer) et Modale d'édition d'œuvre : ajout des champs éditables Code SACEM et Cotage. "
            "6) Filtrage de recherche instantané par Code SACEM et Cotage dans le catalogue. Suite de tests automated pytest (32/32 validés)."
        ),
        "tech_stack": "SQLModel, FastAPI, Next.js 14, TypeScript, Tailwind CSS, Pytest",
        "github_hash": "7e870c7",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/7e870c7",
    },
    {
        "date": "2026-11-10",
        "feature": "Règles Financières & Clôture Comptable (Seuil de Paiement, Report à Nouveau & Mentions Légales)",
        "description": (
            "Implémentation de la Priorité 2 issue de l'analyse comparative critique du logiciel Le Sage : "
            "1) Seuil minimal de paiement paramétrable (min_payment_threshold, défaut 50.00 €) dans WorkspaceSettings "
            "avec calcul déterministe dans apply_advance_recoupment et statut BELOW_THRESHOLD ('En réserve (< 50 €)'). "
            "2) Report à nouveau des soldes ('Solde à nouveau') : continuité comptable stricte entre périodes, conservation "
            "en réserve sous-seuil (retained_reserve_balance), apuration et déblocage automatique dès franchissement du seuil. "
            "3) Traçabilité immuable au Grand Livre dans RoyaltyLedgerEntry (carried_forward_initial, retained_in_reserve, payout_status). "
            "4) Mentions légales et messages conditionnels personnalisables (FR & EN) dans les paramètres éditeur et affichés sur "
            "les décomptes d'auteur (CPI L132-13) et exports CSV. "
            "5) Interface Réconciliation : KPI 5 colonnes avec montant mis en réserve, badges de statut financier (À payer, "
            "En réserve, Avance en cours, Solde nul) et filtres dédiés par statut. Tests unitaires automatisés validés (34/34 passants)."
        ),
        "tech_stack": "SQLModel, FastAPI, Decimal, Next.js 14, TypeScript, Tailwind CSS, Pytest",
        "github_hash": "7e9df2b",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/7e9df2b",
    },
    {
        "date": "2026-11-10",
        "feature": "Projets Audiovisuels, Héritage Contrat & Affiliations Internationales DE/DR CWR 2.1",
        "description": (
            "Implémentation de la Priorité 3 issue de l'analyse comparative critique du logiciel Le Sage : "
            "1) Association directe d'un Contrat d'Édition cadre (contract_id, contract_reference) au niveau d'un Projet Audiovisuel "
            "/ WorkGroup (séries TV quotidiennes TF1, documentaires, films cinéma, albums). "
            "2) Héritage automatique de contrat : les œuvres rattachées à un projet (à la création ou via modification par lot) "
            "héritent automatiquement de la référence contrat du groupe. "
            "3) Endpoint dédié POST /api/v1/work-groups/{id}/apply-inheritance pour propager rétroactivement en 1 clic le contrat cadre "
            "et les splits à toutes les œuvres du projet audiovisuel avec bandeau interactif dans l'interface catalogue. "
            "4) Sociétés de gestion distinctes DE (Exécution Publique) et DR (Reproduction Mécanique) par ayant droit, avec table de "
            "correspondance officielle CISAC (ex: 058 SACEM/SDRM, 010 ASCAP, 021 BMI, 052 PRS, 035 GEMA, 026 SABAM...). "
            "5) Sérialisation CISAC CWR v2.1 stricte des codes OGC dans les enregistrements SPU (Éditeurs) et SWR (Auteurs/Compositeurs). "
            "6) Options avancées d'export CWR (.V21) avec modale de configuration permettant le filtrage par Projet/Série TV "
            "(générant des cue-sheets ciblées par saison) et par plage de dates de création/modification. Suite de tests unitaires (36/36 passants)."
        ),
        "tech_stack": "SQLModel, FastAPI, Next.js 14, TypeScript, Tailwind CSS, CISAC CWR v2.1, Pytest",
        "github_hash": "c005945",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/c005945",
    },
    {
        "date": "2026-11-10",
        "feature": "Résolution Affichage Catalogue POC & Migrations Incrémentales Base de Données",
        "description": (
            "Correction du blocage au lancement du POC où seules 3 œuvres de démonstration s'affichaient au lieu de l'intégralité du catalogue : "
            "1) Automatisation des migrations incrémentales de schéma (_apply_incremental_column_migrations) sur la base de données existante "
            "pour l'ensemble des colonnes ajoutées lors des priorités précédentes (workspace_settings.min_payment_threshold, statement_messages, "
            "works.sacem_work_code, works.cotage_number, right_holders_directory.society_de, society_dr, retained_reserve_balance, "
            "work_groups.contract_id, contract_reference, default_splits, statement_lines.raw_sacem_code, "
            "royalty_ledger_entries.carried_forward_initial, retained_in_reserve, payout_status), résolvant définitivement l'erreur 500 sur GET /api/v1/works. "
            "2) Robustesse de l'import du seed de démonstration dans le lifespan FastAPI avec support d'exécution depuis la racine ou backend/. "
            "3) Extension de la configuration CORS à http://127.0.0.1:3000 et http://localhost:3000. "
            "4) Enrichissement du fallback local DEMO_WORKS côté frontend Next.js. "
            "5) Ajout du test d'intégration test_catalog_display_and_migrations.py validant la migration idempotente et l'affichage des 31 œuvres (37/37 tests passants)."
        ),
        "tech_stack": "FastAPI, SQLModel, SQLite, Next.js 14, CORS, Pytest",
        "github_hash": "8383c0d",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/8383c0d",
    },
    {
        "date": "2026-11-10",
        "feature": "Suppression des Groupes d'Œuvres, Base Vierge en Conditions Réelles & Sélection Globale des Contrats",
        "description": (
            "Mise en conformité complète pour utilisation sur base vierge réelle sans réapparition des données synthétiques : "
            "1) Suppression unitaire et groupée (batch-delete) des Groupes d'Œuvres / Projets Audiovisuels & Albums (DELETE /api/v1/work-groups/{id} "
            "et POST /api/v1/work-groups/batch-delete) avec détachement propre des œuvres sans les supprimer, icône corbeille directe sur chaque badge de projet, "
            "bouton dans le bandeau de projet actif, modale dédiée « Gérer les groupes » avec cases à cocher et modale de confirmation ConfirmDeleteModal. "
            "2) Désactivation du ré-ensemencement automatique (seed_database dans main.py et _seed_default_holders_if_empty dans holders.py) "
            "et suppression des gardes `if (data.length > 0)` et états initiaux `DEMO_*` dans les pages Catalogue, Ayants Droit, Contrats, Royalties et Tableau de bord "
            "qui faisaient réapparaître 6 œuvres, 12 ayants droit et 2 contrats après suppression totale. "
            "3) Nettoyage intégral de la base SQLite locale (0 œuvre, 0 contrat, 0 ayant droit, 0 groupe, 0 ligne Grand Livre) pour démarrer d'une base vierge. "
            "4) Ajout d'une barre d'en-tête « Tout sélectionner » avec case à cocher globale alignée dans l'onglet Contrats. Suite de tests unitaires (39/39 passants)."
        ),
        "tech_stack": "FastAPI, SQLModel, SQLite, Next.js 14, TypeScript, Tailwind CSS, Pytest",
        "github_hash": "fb45bd2",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/fb45bd2",
    },
    {
        "date": "2026-11-10",
        "feature": "Importation Native du Catalogue Espace Membre SACEM (.csv) & Synchronisation Automatique des Ayants Droit",
        "description": (
            "Ajout de la fonctionnalité dédiée « Importer mon catalogue SACEM (.csv) » prenant en charge le format officiel d'export "
            "de l'Espace Membre SACEM (Mes_oeuvres_*.csv, 17 colonnes séparées par point-virgule) : "
            "1) Détection et parsing automatique des colonnes SACEM (Code oeuvre, Titre de l'oeuvre, Sous-titre(s), Genre de l'oeuvre, ISWC, "
            "Date de déclaration, Rôle A/C/AD/E, Nom de l'ayant-droit, COAD, Nom au fichier IPI, Code IPI, Société en DE, Société en DR, "
            "Part DEP, Part DR, Part PHONO, Commentaire). "
            "2) Regroupement multi-lignes par Code oeuvre SACEM, filtrage automatique des lignes doublons « Pas de société » à 0,0000 %, "
            "et fusion intelligente des lignes DE/DR séparées pour les créateurs affiliés à des sociétés étrangères (ex: PRS en DE + MCPS en DR, KODA en DE + NCB en DR, ASCAP, SOCAN). "
            "3) Normalisation déterministe des quotes-parts SACEM à 4 décimales (ex: 33,3330 % x 3 ou 16,6670 % x 4 + 33,3330 %) vers 2 décimales exactes totalisant 100.00 % "
            "(591/591 œuvres du catalogue réel Kaptain Music validées 100 % CWR Ready sans faux positif). "
            "4) Synchronisation automatique à l'import du Répertoire des Ayants Droit (RightHolderDirectory) avec création/mise à jour des fiches "
            "(distinction automatique SOCIETE vs PERSONNE_PHYSIQUE, Code IPI normalisé sur 11 chiffres, Code COAD SACEM, Sociétés DE/DR). "
            "5) Bouton dédié « Importer mon catalogue SACEM (.csv) » dans l'en-tête du Catalogue et modale d'importation pré-configurée sur SACEM_CSV. "
            "Suite de tests unitaires (40/40 passants)."
        ),
        "tech_stack": "FastAPI, SQLModel, Decimal, Next.js 14, TypeScript, Tailwind CSS, SACEM CSV / CWR v2.1, Pytest",
        "github_hash": "880be2a",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/880be2a",
    },
    {
        "date": "2026-11-10",
        "feature": "Pagination Haute Densité et Navigation Inter-Pages (Catalogue & Ayants Droit)",
        "description": (
            "Mise en place d'un système complet et réactif de pagination et de navigation inter-pages pour gérer des catalogues réels volumineux (ex: 591 œuvres SACEM) : "
            "1) Composant générique et réutilisable PaginationBar (frontend/src/components/pagination-bar.tsx) avec sélecteur de densité (25, 50, 100, 250, 500 éléments par page), "
            "indicateur de plage dynamique ('Affichage X–Y sur N'), boutons début (<<), précédent (<), suivant (>), fin (>>), et pastilles de numéros de pages avec fenêtrage intelligent (ellipsis). "
            "2) Intégration complète dans l'onglet Catalogue (frontend/src/app/catalog/page.tsx) pour la vue Table compacte et la vue Cartes détaillées, avec découpage paginatedWorks, "
            "affichage vide si 0 résultat, mini-barre de navigation rapide dans l'en-tête de recherche et réinitialisation automatique à la page 1 lors d'un filtrage ou changement de taille. "
            "3) Intégration identique dans l'onglet Répertoire des Ayants Droit (frontend/src/app/holders/page.tsx) avec découpage paginatedHolders, mini-barre de pagination haute et barre complète basse."
        ),
        "tech_stack": "React, Next.js 14, Tailwind CSS, Lucide React, TypeScript",
        "github_hash": "49bc3a1",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/49bc3a1",
    },
    {
        "date": "2026-11-10",
        "feature": "Atelier de Diagnostic & Santé du Catalogue (Audit 1-Clic & Auto-Réparation Déterministe)",
        "description": (
            "Implémentation de l'US-4.4 inspirée de l'Atelier de réparation de Le Sage pour auditer et assainir instantanément le catalogue : "
            "1) Moteur d'audit automatique (GET /api/v1/works/audit) analysant l'intégralité du répertoire selon les règles CISAC CWR v2.1 et SACEM : "
            "calcul du score de santé global (% d'œuvres saines), détection des codes IPI manquants, déséquilibres de quotes-parts (!= 100.00 %), "
            "co-éditions orphelines sans contrat rattaché, absence d'éditeur contrôlé, codes SACEM (COCV), ISWC et Cotages manquants. "
            "2) Moteur d'auto-réparation déterministe (POST /api/v1/works/audit/auto-repair) avec 3 options sécurisées : injection automatique des codes IPI "
            "depuis le Répertoire des Ayants Droit par correspondance nominative, héritage direct des contrats depuis les Projets Audiovisuels (TF1...), "
            "et rééquilibrage automatique des micro-écarts d'arrondis à 100.00 % exacts. "
            "3) Interface Catalogue : bouton « Atelier Diagnostic & Santé » avec badge dynamique de score, modale grand format avec 4 KPIs synthétiques, "
            "triage par catégorie d'anomalies, tableau haute densité des œuvres en anomalie et ouverture directe dans le drawer d'édition. Suite de tests unitaires (41/41 passants)."
        ),
        "tech_stack": "FastAPI, SQLModel, Decimal, Next.js 14, TypeScript, Tailwind CSS, Lucide React, Pytest",
        "github_hash": "27378fe",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/27378fe",
    },
    {
        "date": "2026-11-10",
        "feature": "Ingestion Native SACEM des Contrats Généraux (CGP1 / .csv) & Liaison aux Œuvres (US-4.1)",
        "description": (
            "Implémentation de l'US-4.1 inspirée du module 'Import des contrats SACEM - CGP1' de Le Sage : "
            "1) Parser officiel SACEM CGP1 Détail (enregistrements 30, 31 et 40) et CSV (backend/app/services/cgp1_parser.py) extrayant "
            "numéros de contrat SACEM, codes CWR, cédants, cessionnaires, codes IPI, quotes-parts DEP/DRM et commentaires. "
            "2) Modèle de données & Schémas enrichis (champs Contract.sacem_contract_number et Contract.cwr_contract_type avec migrations automatiques de colonnes). "
            "3) Endpoint d'importation (POST /api/v1/contracts/import-cgp1) avec création/mise à jour déterministe des contrats, "
            "normalisation des quotes-parts et synchronisation automatique des ayants droit dans le Répertoire (RightHolderDirectory). "
            "4) Endpoint de liaison multi-critères (POST /api/v1/contracts/{id}/link-works) permettant de lier en masse un contrat : "
            "à un projet audiovisuel / album (WorkGroup) avec option de préfixe de cotage séquentiel, à toutes les œuvres du catalogue "
            "où l'ayant droit cocontractant figure (RIGHT_HOLDER_MATCH), ou à une sélection manuelle d'œuvres (SPECIFIC_WORKS). "
            "5) Interface utilisateur Liasse Contractuelle (frontend/src/app/contracts/page.tsx) : bouton d'action 'Importer Contrats SACEM (CGP1 / .csv)' "
            "avec modale de glisser-déposer et rapport d'ingestion détaillé, badges SACEM et CWR sur les fiches de contrats, et modale interactive "
            "'Lier aux œuvres' multi-critères. Suite complète de tests unitaires (43/43 passants)."
        ),
        "tech_stack": "FastAPI, SQLModel, Decimal, Next.js 14, TypeScript, Tailwind CSS, Lucide React, SACEM CGP1 / CWR, Pytest",
        "github_hash": "a59a6e4",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/a59a6e4",
    },
    {
        "date": "2026-11-10",
        "feature": "Workflow de Clôture Périodique & Verrouillage Immuable des Décomptes (DRAFT ➔ LOCKED ➔ PAID - US-4.3)",
        "description": (
            "Implémentation de l'US-4.3 inspirée du cycle comptable formel de Le Sage (Simulation ➔ Clôture ➔ Paiement) : "
            "1) Machine à états formelle sur RoyaltyStatement.accounting_status gérant les trois paliers du cycle financier : "
            "DRAFT (simulation en temps réel avec arbitrages autorisés), LOCKED (verrouillage strict et immuable du Grand Livre "
            "avec génération d'un certificat d'intégrité numérique SHA-256 scellant les écritures) et PAID (apurement définitif "
            "avec date d'exécution bancaire et référence du virement SEPA). "
            "2) Endpoints dédiés : POST /api/v1/statements/{id}/lock-and-post (clôture avec sceau cryptographique), "
            "POST /api/v1/statements/{id}/mark-as-paid (règlement bancaire et bascule des lignes de Grand Livre en PAID), "
            "et POST /api/v1/statements/{id}/reopen-draft (réouverture sécurisée en simulation avec restitution des avances et purge du Grand Livre). "
            "3) Protection comptable stricte : interdiction absolue de modifier des lignes ou de supprimer un relevé dont les règlements bancaires ont été exécutés (statut PAID). "
            "4) Interface utilisateur réactive (frontend/src/app/reconciliation/page.tsx) : bandeau contextuel de pilotage du cycle financier, "
            "modale de clôture formelle avec 4 KPIs synthétiques et contrôle 100.00 %, modale de règlement bancaire avec liste des ayants droit payables et IBANs, "
            "modale du Certificat d'Intégrité affichant l'empreinte SHA-256 copiable en 1 clic et mentions CPI L132-13, et modale de confirmation de réouverture en DRAFT. "
            "5) Suite de tests unitaires automatisée (test_statement_lifecycle.py, 44/44 tests passants)."
        ),
        "tech_stack": "FastAPI, SQLModel, Decimal, SHA-256, Next.js 14, TypeScript, Tailwind CSS, Lucide React, Pytest",
        "github_hash": "38feb6c",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/38feb6c",
    },
    {
        "date": "2026-11-10",
        "feature": "Module Successions d'Auteurs, Héritiers & Tiers Mandataires (Redirection de Paiement - US-4.2)",
        "description": (
            "Implémentation de l'US-4.2 inspirée du module 'Fiche Acteur -> Succession & Tiers Payé' de Le Sage : "
            "1) Modèle RightHolderDirectory enrichi avec is_deceased, deceased_at, payout_recipient_id, payout_recipient_name, "
            "succession_active, succession_notes, et liste structurée d'héritiers (HeirShare : nom, lien de parenté, quote-part %, IBAN/BIC, notes fiscales). "
            "2) Modèle RoyaltyLedgerEntry enrichi pour conserver immuablement dans le Grand Livre les informations de dévolution successorale "
            "(is_succession_payout, heirs_payout_details) et de redirection vers un tiers mandataire (payout_recipient_name). "
            "3) Moteur de calcul déterministe de royalties : préservation absolue du crédit d'auteur original, code IPI et dépôts CWR sur les œuvres "
            "tout en ventilant automatiquement les royalties nettes exigibles entre héritiers selon les quotes-parts notariales (totalisant 100.00 %) "
            "ou en redirigeant le paiement vers le tiers mandataire désigné. "
            "4) Génération de Factures (Factur-X 2026) et Notes de Droits d'auteur intégrant la ventilation détaillée de l'indivision (Art. 815 C. Civ.). "
            "5) Interface Répertoire des Ayants Droit : filtres rapides 'Successions & Décédés' et 'Tiers Payé / Mandataires', "
            "badges contextuels en table haute densité, carte détaillée d'indivision dans les lignes dépliées et section dédiée dans la modale d'édition "
            "avec jauge d'équilibre en temps réel des quotes-parts (100.00 %). "
            "6) Interface Royalties & SACEM : badges contextuels Succession / Tiers Payé et récapitulatif détaillé de dévolution successorale pour chaque ayant droit. "
            "Suite de tests unitaires automatisée (test_succession_and_mandataire.py, 47/47 tests passants)."
        ),
        "tech_stack": "FastAPI, SQLModel, Decimal, Next.js 14, TypeScript, Tailwind CSS, Lucide React, Pytest",
        "github_hash": "dd81d2f",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/dd81d2f",
    },
    {
        "date": "2026-11-11",
        "feature": "Options de Présentation Avancées des Décomptes Auteurs (Territoires, Projets Audiovisuels, Bilingue FR/EN - US-4.6)",
        "description": (
            "Implémentation complète de l'US-4.6 inspirée des 'Options d'impression des décomptes' de Le Sage : "
            "1) Moteur de génération avancé (backend/app/services/holder_statement_generator.py) supportant 4 modes de regroupement : "
            "'WORK' (par œuvre), 'PROJECT' (par projet audiovisuel / série TV / album avec sous-totaux dédiés), 'TERRITORY' "
            "(par pays / zone géographique FR, DE, GB, US, IT, ES, CA, JP, WORLD avec labels bilingues et sous-totaux), et 'RIGHT_TYPE' "
            "(par famille de droits DEP, DRM, SYNC, PHONO, DSN avec libellés officiels et sous-totaux). "
            "2) Présentation bilingue certifiée : génération en français ('FR') ou anglais ('EN') avec traduction intégrale des en-têtes, "
            "labels de lignes, ventilations, synthèses financières et mentions légales de conformité (CPI L132-13). "
            "3) Filtrage déterministe des soldes nuls ('hide_zero_lines' / 'hide_zero_balances') masquant les lignes à 0 € sans activité. "
            "4) Double format d'export haute fidélité : CSV structuré avec en-têtes et sous-totaux commentés, et document officiel certifié "
            "80 colonnes en typographie monospace ('printable_text') copiable et téléchargeable en .txt. "
            "5) Extension de l'API REST (GET /api/v1/statements/{id}/holder-report/{name}?lang=...&group_by=...&hide_zero_lines=...). "
            "6) Interface utilisateur enrichie (frontend/src/app/reconciliation/page.tsx et holder-statement-modal.tsx) : "
            "barre d'options de présentation au-dessus du tableau, regroupement dynamique avec sous-totaux dans les accordéons dépliés, "
            "modale grand format avec prévisualisation alternée Tableau vs Document officiel, boutons d'export CSV, TXT et impression. "
            "Suite complète de tests unitaires automatisée (test_advanced_statements.py, 52/52 tests passants)."
        ),
        "tech_stack": "FastAPI, SQLModel, Decimal, Next.js 14, TypeScript, Tailwind CSS, Lucide React, Pytest",
        "github_hash": "0e79166",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/0e79166",
    },
    {
        "date": "2026-11-11",
        "feature": "Multi-Devises, Table des Parités de Change & Ingestion Déterministe USD/GBP/EUR (US-4.5)",
        "description": (
            "Implémentation complète de l'US-4.5 inspirée de 'Configuration du Sage -> Parités' de Le Sage : "
            "1) Table des parités de change dans WorkspaceSettings (taux officiels BCE pivot EUR : USD, GBP, CAD, CHF, JPY, AUD), "
            "stockant rate_to_eur (multiplicateur déterministe) et rate_bce (cotation officielle 1 € = X devise) avec "
            "API REST complète (GET/PUT /currencies, POST /currencies/reset-bce, POST /convert). "
            "2) Ingestion de relevés multi-devises (POST /api/v1/statements/upload) avec paramètres currency et exchange_rate, "
            "conversion arithmétique stricte Decimal au micro-centime (6 décimales) sans dérive de centime, et persistance "
            "de la devise d'origine (source_currency, exchange_rate, source_gross_amount) sur RoyaltyStatement et StatementLine. "
            "3) Traçabilité inviolable au Grand Livre (RoyaltyLedgerEntry) enregistrant source_currency, exchange_rate et source_gross_allocated. "
            "4) Générateur de décomptes d'auteurs (holder_statement_generator.py), modale HolderStatementModal et exports CSV/ASCII "
            "restituant le montant brut d'origine et la parité de change appliquée. "
            "5) Interface /settings : section 6 'Table des Parités de Change & Multi-Devises', simulateur de conversion déterministe "
            "en temps réel, modale d'ajustement/ajout avec calcul réciproque automatique et bouton de réinitialisation aux cours BCE. "
            "6) Interface /reconciliation : modale d'importation multi-devises avec pré-remplissage automatique des cours BCE, "
            "badges contextuels sur les décomptes et double affichage devise d'origine / EUR sur les lignes de répartition. "
            "Suite de tests unitaires automatisée (test_multi_currency.py, 56/56 tests passants)."
        ),
        "tech_stack": "FastAPI, SQLModel, Decimal, Next.js 14, TypeScript, Tailwind CSS, Lucide React, BCE Rates, Pytest",
        "github_hash": "e32b710",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/e32b710",
    },
    {
        "date": "2026-11-12",
        "feature": "Télétransmission Bancaire SEPA XML ISO 20022 (pain.001.001.03) & Audit Pré-Vol (US-4.7)",
        "description": (
            "Implémentation complète de l'US-4.7 inspirée du module 'Virements bancaires' de Le Sage : "
            "1) Algorithmes de conformité et validation bancaire : validateur modulo-97 ISO 13616 pour IBAN européen avec normalisation et nettoyage, "
            "validateur de code BIC ISO 9362 (8 ou 11 caractères), assainisseur de texte XML (conversion diacritique ASCII, limitation de taille "
            "et échappement des entités XML & < > \" '). "
            "2) Générateur SEPA ISO 20022 pain.001.001.03 (SEPA Credit Transfer) : structure conforme EPC avec Group Header (<GrpHdr> MsgId, "
            "CreDtTm, NbOfTxs, CtrlSum, InitgPty), informations de paiement groupé (<PmtInf> PmtInfId, PmtMtd TRF, BtchBookg true, PmtTpInf SEPA, "
            "ReqdExctnDt, Dbtr, DbtrAcct, DbtrAgt, ChrgBr SLEV), et transactions individuelles (<CdtTrfTxInf> PmtId EndToEndId, Amt InstdAmt Ccy EUR, "
            "CdtrAgt, Cdtr, CdtrAcct IBAN, RmtInf Ustrd). "
            "3) Prise en compte transparente de la dévolution successorale (US-4.2) avec ventilation automatique de virements distincts par héritier, "
            "et prise en charge des mandataires de paiement (payout_recipient_name). "
            "4) Filtre d'éligibilité et audit pré-vol complet : exclusion déterministe avec motifs explicites des soldes sous le seuil minimal "
            "(min_payment_threshold, ex: 50 €), des avances en cours d'amortissement, des soldes nuls ou négatifs, et détection des coordonnées "
            "bancaires manquantes ou invalides. "
            "5) Endpoints API REST : GET /api/v1/statements/{id}/sepa-preview pour l'audit pré-vol avant génération, et POST /api/v1/statements/{id}/export-sepa "
            "pour la génération déterministe du fichier XML avec somme de contrôle. "
            "6) Gestion du compte éditeur débiteur : champs publisher_iban et publisher_bic dans WorkspaceSettings, migrations de schéma, "
            "persistance et édition dans /settings (Identité Éditeur). "
            "7) Interface /reconciliation : bouton 'Virement SEPA XML (pain.001)', modale grand format interactive avec 4 cartes métriques, "
            "sélecteur de date d'exécution et préfixe de libellé, onglets 'Virements Inclus' et 'Exclus / Reportés' avec badges successoraux, "
            "téléchargement direct du fichier .xml, copie du contenu XML, et passerelle 1-clic vers l'enregistrement du règlement (PAID). "
            "Suite complète de 60 tests unitaires et d'intégration validée (test_sepa_export.py, 60/60 tests passants)."
        ),
        "tech_stack": "FastAPI, SQLModel, Decimal, ISO 20022 (pain.001), ISO 13616 Modulo-97, Next.js 14, TypeScript, Tailwind CSS, Pytest",
        "github_hash": "70f2ece",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/70f2ece",
    },
    {
        "date": "2026-11-12",
        "feature": "Ergonomie Tiroir d'Œuvre (Sous-Onglets & Équilibrage 1-Clic) & Passerelle Black Box (US-5.1 & US-5.2)",
        "description": (
            "Implémentation des deux Quick Wins ergonomiques majeurs de la Priorité 5 : "
            "1) US-5.1 (Refonte du Tiroir d'Œuvre WorkDetailDrawer) : modularisation et extraction du tiroir monolithique vers frontend/src/components/catalog/work-detail-drawer.tsx, "
            "découpage structuré en 4 sous-onglets thématiques lisibles (1. Identifiants & Métadonnées, 2. Quotes-Parts & Jauges, 3. Contrats & Projets TF1, 4. Historique & Audit CWR), "
            "jauges d'équilibre visuelles en temps réel (DEP, DRM, SYNC, PHONO), alerte de complétude des IPI créateurs, bouton de propagation d'héritage contrat cadre, "
            "et action 1-clic contextuelle « Équilibrer le reste sur l'éditeur » injectant le reliquat exact sans calcul mental pour atteindre 100.00 % émeraude. "
            "2) US-5.2 (Passerelle Black Box & Tri Pareto) : endpoint backend POST /api/v1/statements/{id}/lines/{line_id}/create-work-and-match créant l'œuvre au catalogue avec embedding 384d, "
            "calculant les allocations déterministes, validant la ligne en statut VALIDATED et traçant les logs d'audit ; extension du filtre sort_by=gross_amount_desc "
            "sur GET /api/v1/statements/{id}/lines et tri côté client dans l'inbox pour prioriser 80 % de la valeur financière (loi de Pareto) ; filtre dédié Black Box "
            "et modale interactive BlackBoxCreateModal pré-remplie depuis la ligne orpheline (titre brut assaini, artiste, ISRC, SACEM, cotage) avec autocomplétion IPI depuis le Répertoire. "
            "Suite complète de tests unitaires et d'intégration validée (backend/tests/test_black_box_gateway.py, 68/68 tests backend passants)."
        ),
        "tech_stack": "FastAPI, SQLModel, Decimal, Next.js 14, TypeScript, Tailwind CSS, Lucide React, Pytest",
        "github_hash": "3df205d",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/3df205d",
    },
    {
        "date": "2026-11-12",
        "feature": "Assistant d'Onboarding Interactif (Setup Wizard), Empty States Actionnables & Bac à Sable Démo (US-5.6)",
        "description": (
            "Refonte complète de l'expérience de premier contact sur base vierge : "
            "1) Assistant Setup Wizard interactif en 4 étapes clés (Identité Éditeur avec IPI/IBAN SEPA, Ingestion Catalogue SACEM .csv/.xlsx, "
            "Liasses & Contrats PDF/CGP1 avec validation Human-in-the-loop, Première simulation financière DSP). Barre de progression, "
            "persistance de l'état (WorkspaceSettings & localStorage) et panneau rétractable. "
            "2) Élimination des faux positifs sur le tableau de bord (0 œuvre / 0 contrat) et déploiement de cartes d'accueil "
            "EmptyState bienveillantes avec boutons d'actions directes et conseils métier sur les pages clés (/catalog, /holders, /contracts, /reconciliation). "
            "3) Bac à sable de démonstration réinitialisable : chargement en 1 clic d'un jeu de données complet (30 œuvres, 3 projets TF1, "
            "9 ayants droit, 4 contrats, relevé DSP) et purge intégrale de la base de données avec dialogue de confirmation sécurisé "
            "(POST /api/v1/sandbox/load-demo et POST /api/v1/sandbox/reset). Suite de tests unitaires et d'intégration validée (73/73 tests passants)."
        ),
        "tech_stack": "FastAPI, SQLModel, Next.js 14, TypeScript, Tailwind CSS, Lucide React, Pytest",
        "github_hash": "8685773",
        "github_url": "https://github.com/aboulet13/rights-copilot/commit/8685773",
    },
]


def generate_markdown() -> str:
    lines = [
        "# 📋 Suivi des Fonctionnalités Implémentées — Korom",
        "",
        "> Ce document récapitule l'ensemble des fonctionnalités implémentées et modifiées depuis la création du projet,",
        "> avec leur date de livraison, leur description détaillée, la pile technologique mobilisée et la référence du commit GitHub.",
        "",
        "| Date | Feature | Description | Tech stack | GitHub |",
        "| :--- | :--- | :--- | :--- | :--- |",
    ]
    for row in DATA:
        # Format markdown cell values (escape pipe characters)
        desc = row["description"].replace("|", "\\|")
        tech = row["tech_stack"].replace("|", "\\|")
        gh = f"[`{row['github_hash']}`]({row['github_url']})"
        lines.append(f"| {row['date']} | **{row['feature']}** | {desc} | `{tech}` | {gh} |")

    lines.append("")
    lines.append("---")
    lines.append(f"*Dernière mise à jour : 2026-11-12 | Total fonctionnalités répertoriées : {len(DATA)}*")
    lines.append("")
    return "\n".join(lines)


def generate_csv() -> str:
    output = io.StringIO()
    # Add BOM for Excel compatibility
    output.write("\ufeff")
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_ALL)
    writer.writerow(["Date", "Feature", "Description", "Tech stack", "GitHub"])
    for row in DATA:
        writer.writerow([
            row["date"],
            row["feature"],
            row["description"],
            row["tech_stack"],
            row["github_url"],
        ])
    return output.getvalue()


def generate_xlsx_bytes() -> bytes:
    """Génère un fichier .xlsx conforme OpenXML standard avec mise en forme des en-têtes et retour à la ligne."""
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>"""

    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

    wb_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

    workbook = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Features Korom" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>"""

    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><name val="Aptos"/><sz val="11"/><color rgb="FF1F2937"/></font>
    <font><b/><name val="Aptos"/><sz val="11"/><color rgb="FFFFFFFF"/></font>
    <font><b/><name val="Aptos"/><sz val="11"/><color rgb="FF111827"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE5E7EB"/></left>
      <right style="thin"><color rgb="FFE5E7EB"/></right>
      <top style="thin"><color rgb="FFE5E7EB"/></top>
      <bottom style="thin"><color rgb="FFE5E7EB"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <!-- 0: default -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1: Header (Dark Blue background, bold white text) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 2: Regular data cell with border & top alignment -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="top" wrapText="1"/>
    </xf>
    <!-- 3: Feature title bold cell with border & top alignment -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="top" wrapText="1"/>
    </xf>
  </cellXfs>
</styleSheet>"""

    # Build sheet1.xml
    sheet_rows = []
    # Header row
    sheet_rows.append(
        '<row r="1" ht="28" customHeight="1">'
        '<c r="A1" s="1" t="inlineStr"><is><t>Date</t></is></c>'
        '<c r="B1" s="1" t="inlineStr"><is><t>Feature</t></is></c>'
        '<c r="C1" s="1" t="inlineStr"><is><t>Description</t></is></c>'
        '<c r="D1" s="1" t="inlineStr"><is><t>Tech stack</t></is></c>'
        '<c r="E1" s="1" t="inlineStr"><is><t>GitHub</t></is></c>'
        '</row>'
    )

    for idx, row in enumerate(DATA, start=2):
        d_val = escape(row["date"])
        f_val = escape(row["feature"])
        desc_val = escape(row["description"])
        t_val = escape(row["tech_stack"])
        gh_val = escape(f"{row['github_hash']} ({row['github_url']})")

        sheet_rows.append(
            f'<row r="{idx}" ht="70" customHeight="0">'
            f'<c r="A{idx}" s="2" t="inlineStr"><is><t>{d_val}</t></is></c>'
            f'<c r="B{idx}" s="3" t="inlineStr"><is><t>{f_val}</t></is></c>'
            f'<c r="C{idx}" s="2" t="inlineStr"><is><t>{desc_val}</t></is></c>'
            f'<c r="D{idx}" s="2" t="inlineStr"><is><t>{t_val}</t></is></c>'
            f'<c r="E{idx}" s="2" t="inlineStr"><is><t>{gh_val}</t></is></c>'
            '</row>'
        )

    sheet1 = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="14" customWidth="1"/>
    <col min="2" max="2" width="34" customWidth="1"/>
    <col min="3" max="3" width="70" customWidth="1"/>
    <col min="4" max="4" width="36" customWidth="1"/>
    <col min="5" max="5" width="45" customWidth="1"/>
  </cols>
  <sheetData>
    {"".join(sheet_rows)}
  </sheetData>
</worksheet>"""

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("xl/_rels/workbook.xml.rels", wb_rels)
        zf.writestr("xl/workbook.xml", workbook)
        zf.writestr("xl/styles.xml", styles)
        zf.writestr("xl/worksheets/sheet1.xml", sheet1)

    return buf.getvalue()


def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    # 1. FEATURES_TRACKING.md
    md_content = generate_markdown()
    md_path = os.path.join(root_dir, "FEATURES_TRACKING.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"✓ Généré : {md_path}")

    # 2. FEATURES_TRACKING.xlsx
    xlsx_bytes = generate_xlsx_bytes()
    xlsx_path = os.path.join(root_dir, "FEATURES_TRACKING.xlsx")
    with open(xlsx_path, "wb") as f:
        f.write(xlsx_bytes)
    print(f"✓ Généré : {xlsx_path}")

    # 3. FEATURES_TRACKING.csv
    csv_content = generate_csv()
    csv_path = os.path.join(root_dir, "FEATURES_TRACKING.csv")
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write(csv_content)
    print(f"✓ Généré : {csv_path}")


if __name__ == "__main__":
    main()
