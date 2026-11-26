#!/usr/bin/env bash

# ==============================================================================
# RightsCopilot — Lanceur 1-Clic POC & Démo Locale
# Démarre automatiquement le Backend FastAPI (port 8000) et le Frontend Next.js (port 3000)
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}   🎵 RightsCopilot — Plateforme IA de Gestion Éditoriale & Royalties         ${NC}"
echo -e "${BLUE}==============================================================================${NC}"

# 1. Vérification de l'environnement virtuel Python
if [ ! -f "$VENV_PYTHON" ]; then
    echo -e "${YELLOW}⚠️ Environnement virtuel Python introuvable dans $BACKEND_DIR/.venv.${NC}"
    echo -e "${BLUE}Création de l'environnement virtuel et installation des dépendances...${NC}"
    python3 -m venv "$BACKEND_DIR/.venv"
    "$BACKEND_DIR/.venv/bin/pip" install --upgrade pip
    "$BACKEND_DIR/.venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
fi

# 2. Vérification des dépendances Node.js
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}⚠️ Dépendances frontend non installées dans $FRONTEND_DIR/node_modules.${NC}"
    echo -e "${BLUE}Installation des paquets npm...${NC}"
    (cd "$FRONTEND_DIR" && npm install)
fi

# 3. Vérification du fichier .env
if [ ! -f "$PROJECT_ROOT/.env" ] && [ -f "$PROJECT_ROOT/.env.example" ]; then
    echo -e "${YELLOW}ℹ️ Création d'un fichier .env à partir de .env.example...${NC}"
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
fi

# 4. Initialisation / Seeding automatique de la base locale si besoin
echo -e "${BLUE}Initialisation et vérification des tables de la base de données...${NC}"
(
    cd "$BACKEND_DIR"
    PYTHONPATH=. "$VENV_PYTHON" -c "
from app.core.database import init_db
init_db()
"
)

# 5. Gestion de l'arrêt propre des processus (SIGINT / Ctrl+C)
cleanup() {
    echo ""
    echo -e "${YELLOW}Arrêt des serveurs RightsCopilot...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    # Libère les ports au cas où
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}Serveurs arrêtés proprement. À bientôt !${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Libération préalable des ports 8000 et 3000 si un ancien process traîne
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# 6. Démarrage du Backend FastAPI
echo -e "${GREEN}🚀 Démarrage du Backend FastAPI sur http://127.0.0.1:8000 ...${NC}"
(
    cd "$BACKEND_DIR"
    exec "$VENV_PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
) &
BACKEND_PID=$!

# 7. Démarrage du Frontend Next.js
echo -e "${GREEN}🚀 Démarrage du Frontend Next.js sur http://localhost:3000 ...${NC}"
(
    cd "$FRONTEND_DIR"
    exec npm run dev -- -p 3000
) &
FRONTEND_PID=$!

# 8. Attente que le frontend réponde
echo -e "${BLUE}Attente du démarrage des services...${NC}"
until curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; do
    sleep 0.5
done
until curl -s http://localhost:3000 > /dev/null 2>&1; do
    sleep 0.5
done

echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}   ✅ RightsCopilot est en ligne et prêt pour la démo !                       ${NC}"
echo -e "${GREEN}   👉 Frontend : http://localhost:3000                                        ${NC}"
echo -e "${GREEN}   👉 Swagger  : http://127.0.0.1:8000/docs                                   ${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${YELLOW}Appuyez sur Ctrl+C pour arrêter les serveurs.${NC}"
echo ""

# Ouverture automatique dans le navigateur par défaut (macOS / Linux / Windows WSL)
if command -v open > /dev/null 2>&1; then
    open "http://localhost:3000"
elif command -v xdg-open > /dev/null 2>&1; then
    xdg-open "http://localhost:3000"
fi

# Maintient le script en vie
wait
