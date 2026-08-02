#!/usr/bin/env bash
# ============================================================
# NOVA PANEL — Installer & Management Script
# ============================================================
#  Host   : $(hostname)
#  Docker : $(command -v docker &>/dev/null && echo "ON" || echo "OFF")
#  Kubek  : $(command -v kubectl &>/dev/null && echo "ON" || echo "OFF")
#  Port   : 8000
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

REPO_URL="https://github.com/risalnrisal6-glitch/HOSTING-DASH.git"
INSTALL_DIR="$HOME/nova-panel"
NODE_VERSION="20"
LOG_FILE="/tmp/nova-panel-install.log"

# ──────────────────────────────────────────────
# Helper functions
# ──────────────────────────────────────────────

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
info()  { echo -e "${CYAN}[i]${NC} $1"; }
header(){ echo -e "\n${MAGENTA}${BOLD}═══ $1 ═══${NC}\n"; }

banner() {
  clear
  echo -e "${BLUE}${BOLD}"
  echo '   ╔═══════════════════════════════════════════╗'
  echo '   ║        ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ║'
  echo '   ║        ████╗  ██║██╔═══██╗██║   ██║██╔══██╗║'
  echo '   ║        ██╔██╗ ██║██║   ██║██║   ██║███████║║'
  echo '   ║        ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║║'
  echo '   ║        ██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║║'
  echo '   ║        ╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝║'
  echo '   ║         P R E M I U M   H O S T I N G        ║'
  echo '   ║              P A N E L                        ║'
  echo '   ╚═══════════════════════════════════════════╝'
  echo -e "${NC}"
  echo -e "   ${CYAN}Host   :${NC} $(hostname)"
  echo -e "   ${CYAN}Docker :${NC} $(command -v docker &>/dev/null && echo -e "${GREEN}ON${NC}" || echo -e "${RED}OFF${NC}")"
  echo -e "   ${CYAN}Kubek  :${NC} $(command -v kubectl &>/dev/null && echo -e "${GREEN}ON${NC}" || echo -e "${RED}OFF${NC}")"
  echo -e "   ${CYAN}Port   :${NC} 8000"
  echo -e "   ${CYAN}GitHub :${NC} ${REPO_URL}"
  echo -e "   ${CYAN}Node   :${NC} $(node -v 2>/dev/null || echo 'not installed')"
  echo -e "   ${CYAN}Arch   :${NC} $(uname -m)"
  echo -e "   ${CYAN}OS     :${NC} $(uname -s)"
  echo -e "\n   ------------------------------------------"
}

check_deps() {
  local missing=0
  header "Checking Dependencies"

  if command -v node &>/dev/null; then
    log "Node.js $(node -v)"
  else
    error "Node.js is not installed"
    info "Install it: curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash - && sudo apt-get install -y nodejs"
    missing=1
  fi

  if command -v npm &>/dev/null; then
    log "npm $(npm -v)"
  else
    error "npm is not installed"
    missing=1
  fi

  if command -v git &>/dev/null; then
    log "Git $(git --version | cut -d' ' -f3)"
  else
    error "Git is not installed"
    missing=1
  fi

  if command -v docker &>/dev/null; then
    log "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
  else
    warn "Docker not found (optional — for containerized deployment)"
  fi

  if [ "$missing" -ne 0 ]; then
    error "Please install missing dependencies and re-run"
    exit 1
  fi
}

# ──────────────────────────────────────────────
# Install
# ──────────────────────────────────────────────

install_panel() {
  banner
  check_deps
  header "Installing NOVA PANEL"

  # Clone repo
  if [ -d "$INSTALL_DIR" ]; then
    warn "Directory $INSTALL_DIR already exists"
    read -rp "Overwrite? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
      rm -rf "$INSTALL_DIR"
    else
      info "Using existing installation"
    fi
  fi

  if [ ! -d "$INSTALL_DIR" ]; then
    info "Cloning repository..."
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" 2>&1 | tee -a "$LOG_FILE"
    log "Repository cloned"
  fi

  cd "$INSTALL_DIR"

  # Install dependencies
  info "Installing npm dependencies..."
  npm install 2>&1 | tee -a "$LOG_FILE"
  log "Dependencies installed"

  # Setup environment
  if [ ! -f apps/api/.env ]; then
    info "Creating .env with randomly generated secrets..."
    # Generate strong random secrets so the API never runs with known
    # placeholders (config.ts refuses to start in production without them).
    JWT_SECRET_GEN="$(openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 48)"
    JWT_REFRESH_GEN="$(openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 48)"
    ENCRYPTION_KEY_GEN="$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | tr -dc 'a-f0-9' | head -c 64)"
    cat > apps/api/.env << EOF
NODE_ENV=development
PORT=4000
JWT_SECRET=${JWT_SECRET_GEN}
JWT_REFRESH_SECRET=${JWT_REFRESH_GEN}
ENCRYPTION_KEY=${ENCRYPTION_KEY_GEN}
CORS_ORIGIN=http://localhost:3000
EOF
    log "Random secrets generated and saved to apps/api/.env"
  fi

  # Push database schema
  info "Setting up database..."
  cd apps/api
  npx prisma db push 2>&1 | tee -a "$LOG_FILE"
  npx prisma generate 2>&1 | tee -a "$LOG_FILE"
  cd "$INSTALL_DIR"

  log "Database initialized"

  # Build
  info "Building production assets..."
  npm run build 2>&1 | tee -a "$LOG_FILE"
  log "Build complete"

  echo -e "\n${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║     ✅  NOVA PANEL INSTALLED SUCCESSFULLY    ║${NC}"
  echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
  echo -e ""
  echo -e "   ${CYAN}Install dir:${NC} $INSTALL_DIR"
  echo -e "   ${CYAN}Start panel:${NC} cd $INSTALL_DIR && bash installer.sh"
  echo -e "   ${CYAN}Select option 2 (Start)${NC}"
  echo -e ""
  echo -e "   ${YELLOW}Default admin login:${NC}"
  echo -e "   Email:    admin@nova.dev"
  echo -e "   Password: Admin@12345"
  echo -e ""
  echo -e "   ${YELLOW}Important:${NC} Strong random secrets were auto-generated."
  echo -e "   Set NODE_ENV=production in apps/api/.env only after you"
  echo -e "   have configured your Pterodactyl panel connection."
  echo -e ""
}

# ──────────────────────────────────────────────
# Start
# ──────────────────────────────────────────────

start_panel() {
  if [ ! -d "$INSTALL_DIR" ]; then
    error "NOVA PANEL not installed. Select option 1 first."
    return
  fi
  cd "$INSTALL_DIR"

  # Check if already running
  if [ -f /tmp/nova-api.pid ] && kill -0 "$(cat /tmp/nova-api.pid)" 2>/dev/null; then
    warn "API is already running (PID: $(cat /tmp/nova-api.pid))"
  else
    info "Starting API server on port 4000..."
    cd apps/api
    nohup npx tsx src/index.ts > /tmp/nova-api.log 2>&1 &
    echo $! > /tmp/nova-api.pid
    cd "$INSTALL_DIR"
    log "API started (PID: $(cat /tmp/nova-api.pid))"
  fi

  if [ -f /tmp/nova-web.pid ] && kill -0 "$(cat /tmp/nova-web.pid)" 2>/dev/null; then
    warn "Web server is already running (PID: $(cat /tmp/nova-web.pid))"
  else
    info "Starting Web server on port 3000..."
    cd apps/web
    nohup npx next start -p 3000 > /tmp/nova-web.log 2>&1 &
    echo $! > /tmp/nova-web.pid
    cd "$INSTALL_DIR"
    log "Web server started (PID: $(cat /tmp/nova-web.pid))"
  fi

  echo -e "\n${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║      🚀  NOVA PANEL IS NOW RUNNING           ║${NC}"
  echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
  echo -e ""
  echo -e "   ${CYAN}Website:${NC}  http://localhost:3000"
  echo -e "   ${CYAN}API:${NC}      http://localhost:4000"
  echo -e "   ${CYAN}Health:${NC}   http://localhost:4000/api/health"
  echo -e ""
  echo -e "   ${YELLOW}Login:${NC} admin@nova.dev / Admin@12345"
  echo -e ""
}

# ──────────────────────────────────────────────
# Stop
# ──────────────────────────────────────────────

stop_panel() {
  header "Stopping NOVA PANEL"

  if [ -f /tmp/nova-web.pid ]; then
    kill "$(cat /tmp/nova-web.pid)" 2>/dev/null && log "Web server stopped" || warn "Web server was not running"
    rm -f /tmp/nova-web.pid
  fi

  if [ -f /tmp/nova-api.pid ]; then
    kill "$(cat /tmp/nova-api.pid)" 2>/dev/null && log "API server stopped" || warn "API server was not running"
    rm -f /tmp/nova-api.pid
  fi

  info "All services stopped"
}

# ──────────────────────────────────────────────
# Restart
# ──────────────────────────────────────────────

restart_panel() {
  header "Restarting NOVA PANEL"
  stop_panel
  sleep 2
  start_panel
}

# ──────────────────────────────────────────────
# Terminal (Console)
# ──────────────────────────────────────────────

terminal_console() {
  header "NOVA PANEL — Terminal Console"
  echo -e "   ${YELLOW}Access the server console by logging into the panel.${NC}"
  echo -e ""
  echo -e "   ${CYAN}Web Console:${NC} http://localhost:3000/servers"
  echo -e "   ${CYAN}API Health:${NC}  http://localhost:4000/api/health"
  echo -e ""
  echo -e "   ${YELLOW}Or connect directly to the API:${NC}"
  echo -e "   curl -s http://localhost:4000/api/health"
  echo -e ""
  read -rp "Press Enter to return to menu..."
}

# ──────────────────────────────────────────────
# Logs
# ──────────────────────────────────────────────

view_logs() {
  header "NOVA PANEL — Logs"
  echo -e "   ${CYAN}1)${NC} API logs"
  echo -e "   ${CYAN}2)${NC} Web server logs"
  echo -e "   ${CYAN}3)${NC} Both (tail -f)"
  echo -e "   ${CYAN}0)${NC} Back to menu"
  echo ""
  read -rp "Select option: " log_opt

  case "$log_opt" in
    1)
      if [ -f /tmp/nova-api.log ]; then
        tail -50 /tmp/nova-api.log
      else
        error "No API log found"
      fi
      ;;
    2)
      if [ -f /tmp/nova-web.log ]; then
        tail -50 /tmp/nova-web.log
      else
        error "No Web log found"
      fi
      ;;
    3)
      echo -e "${YELLOW}Press Ctrl+C to stop viewing logs${NC}"
      tail -f /tmp/nova-api.log /tmp/nova-web.log 2>/dev/null || error "Log files not found"
      ;;
    *) return ;;
  esac
  echo ""
  read -rp "Press Enter to return to menu..."
}

# ──────────────────────────────────────────────
# Uninstall
# ──────────────────────────────────────────────

uninstall_panel() {
  header "Uninstall NOVA PANEL"

  echo -e "${RED}${BOLD}WARNING: This will remove all NOVA PANEL data!${NC}"
  echo -e ""
  echo -e "   - Remove installation directory: $INSTALL_DIR"
  echo -e "   - Remove database files"
  echo -e "   - Stop all running services"
  echo -e ""
  read -rp "Are you sure? Type 'YES' to confirm: " confirm

  if [ "$confirm" != "YES" ]; then
    info "Uninstall cancelled"
    return
  fi

  stop_panel

  if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    log "Removed $INSTALL_DIR"
  fi

  rm -f /tmp/nova-api.pid /tmp/nova-web.pid /tmp/nova-api.log /tmp/nova-web.log /tmp/nova-panel-install.log

  echo -e "\n${GREEN}${BOLD}NOVA PANEL has been uninstalled.${NC}"
  echo -e "${YELLOW}Goodbye! 👋${NC}"
  echo ""
  exit 0
}

# ──────────────────────────────────────────────
# Main Menu
# ──────────────────────────────────────────────

main_menu() {
  while true; do
    banner
    echo -e "   ${BOLD}${CYAN}1)${NC} Install"
    echo -e "   ${BOLD}${CYAN}2)${NC} Start"
    echo -e "   ${BOLD}${CYAN}3)${NC} Stop"
    echo -e "   ${BOLD}${CYAN}4)${NC} Restart"
    echo -e "   ${BOLD}${CYAN}5)${NC} Terminal (Console)"
    echo -e "   ${BOLD}${CYAN}6)${NC} Logs (Info/Status)"
    echo -e "   ${BOLD}${CYAN}7)${NC} Uninstall"
    echo -e "   ${BOLD}${RED}0)${NC} Exit"
    echo -e "\n   ------------------------------------------"
    read -rp "   Select Option: " choice

    case "$choice" in
      1) install_panel ;;
      2) start_panel ;;
      3) stop_panel ;;
      4) restart_panel ;;
      5) terminal_console ;;
      6) view_logs ;;
      7) uninstall_panel ;;
      0)
        echo -e "\n${GREEN}Goodbye! 👋${NC}\n"
        exit 0
        ;;
      *) warn "Invalid option: $choice" ; sleep 1 ;;
    esac
  done
}

# ──────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────

# If 'install' argument is passed, run non-interactive install
if [ "${1:-}" = "install" ]; then
  install_panel
  exit 0
fi

main_menu