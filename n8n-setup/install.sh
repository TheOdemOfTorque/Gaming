#!/bin/bash
set -e

DOMAIN="n8n.fluxautomation.de"

echo "==> n8n Setup für ${DOMAIN}"
echo ""

# 1. System aktualisieren
echo "[1/4] System aktualisieren..."
apt-get update -qq
apt-get upgrade -y -qq

# 2. Docker installieren (falls nicht vorhanden)
if ! command -v docker &> /dev/null; then
  echo "[2/4] Docker installieren..."
  apt-get install -y -qq ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  echo "    Docker installiert."
else
  echo "[2/4] Docker bereits installiert, überspringe."
fi

# 3. Projektverzeichnis anlegen und Compose-Datei kopieren
echo "[3/4] Verzeichnis und Konfiguration anlegen..."
mkdir -p /opt/n8n
cp "$(dirname "$0")/docker-compose.yml" /opt/n8n/docker-compose.yml

# 4. Dienste starten
echo "[4/4] n8n und Traefik starten..."
cd /opt/n8n
docker compose pull
docker compose up -d

echo ""
echo "Fertig! n8n läuft unter https://${DOMAIN}"
echo ""
echo "WICHTIG: Stelle sicher, dass der DNS-Eintrag für ${DOMAIN}"
echo "         auf die IP dieses Servers zeigt, bevor du die URL aufrufst."
echo ""
echo "Logs anzeigen:    docker compose -f /opt/n8n/docker-compose.yml logs -f"
echo "Neustart:         docker compose -f /opt/n8n/docker-compose.yml restart"
echo "Stoppen:          docker compose -f /opt/n8n/docker-compose.yml down"
