# RightsCopilot 🎵

> **"Copyrights and royalties, streamlined."**  
> Plateforme moderne de gestion de catalogue éditorial, rapprochement de relevés de redevances (SACEM / DSP streaming) et calcul financier déterministe pour éditeurs de musique indépendants.

---

## ⚡ Lancement Rapide en 1 Clic (Démo Locale)

Pour lancer l'ensemble de la plateforme (Backend FastAPI + Frontend Next.js 15) en une seule commande :

```bash
./start_poc.sh
```

Le script :
1. Démarre le **Backend FastAPI** sur [http://127.0.0.1:8000](http://127.0.0.1:8000) (Documentation interactive : [/docs](http://127.0.0.1:8000/docs)).
2. Démarre le **Frontend Next.js Haute Densité** sur [http://localhost:3000](http://localhost:3000).
3. Ouvre automatiquement votre navigateur par défaut sur le tableau de bord.
4. Pour arrêter les serveurs, faites simplement `Ctrl + C` dans le terminal.

---

## 🎯 Parcours de Démonstration (POC 3 Minutes)

L'application a été conçue pour prouver la valeur métier en moins de 3 minutes face à un directeur d'édition musicale ou un gestionnaire de royalties :

1. **Onglet Catalogue (`/catalog`)** :
   - Cliquez sur **« Importer / Migrer Catalogue (Le Sage / CWR) »**.
   - Sélectionnez le fichier de test de **1 200 œuvres CWR v2.1** (`data/samples/CW261104_LESAGE_STOCK_1200_OEUVRES.V21`).
   - Observez le rapport de pré-validation CWR instantané et l'identification des 12 anomalies de splits sans altération de données.
2. **Onglet Contrats IA (`/contracts`)** :
   - Cliquez sur **« Démo 1 : Minuit sur la Seine »**.
   - Visualisez l'extraction automatique des clauses par Document AI (parties, splits 50/25/25, avance de 5 000 €).
   - Cliquez sur **« Valider & Enregistrer au Catalogue »** : l'œuvre et les fiches des ayants droit sont automatiquement synchronisées.
3. **Onglet Réconciliation (`/reconciliation`)** :
   - Cliquez sur **« 1. Démo Express (5 lignes) »** ou **« Stress-Test 5 000 Lignes DSP »**.
   - Constatez le rapprochement instantané en $O(1)$ sans passer par Excel XLOOKUP, même sur les titres tronqués ou sans ISWC.
   - Cliquez sur **« Recalculer Royalties »** puis **« Clôturer & Imputer Avances (LOCKED) »** pour figer l'amortissement au Grand Livre.
   - Cliquez sur le bouton **« Facture / NDA »** pour basculer vers l'annuaire.
4. **Onglet Ayants Droit & Facturation (`/holders`)** :
   - Visualisez la distinction statutaire entre **Personnes Physiques** (Note de droits d'auteur + Précompte IRCEC/URSSAF de 11,10%) et **Sociétés** (Facture Factur-X 2026 + TVA 10%).
   - Téléchargez ou imprimez la note prête à l'emploi avec montants nets issus du décompte clôturé.

---

## 🛠️ Stack Technique

- **Backend** : Python 3.11+, FastAPI, SQLModel / SQLAlchemy, Pydantic v2, SQLite / PostgreSQL (`pgvector`), Fastembed.
- **Frontend** : Next.js 15 (App Router), TypeScript, Tailwind CSS, Lucide Icons.
- **Standards MusicTech & FinTech** : CISAC CWR v2.1 (Common Works Registration), DDEX DSR, Factur-X (EN 16931).

---

## 🧪 Tests Unitaires & Intégrité Mathématique

Pour vérifier l'ensemble des 18 tests unitaires (arrondis, micro-centimes, non-régression, matching, CWR) :

```bash
./backend/.venv/bin/python -m unittest discover -s backend/tests -t backend -v
./frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```
