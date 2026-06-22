#!/usr/bin/env bash
# Run on your Hetzner CPU server (SSH in as root or sudo user).
set -euo pipefail

MODEL="${BORG_AI_MODEL:-llama3.2:3b}"
KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:-30m}"

wait_for_ollama() {
  local tries=0
  until curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -ge 30 ]; then
      echo "Ollama did not become ready. Check: systemctl status ollama"
      journalctl -u ollama -n 30 --no-pager || true
      exit 1
    fi
    sleep 1
  done
}

echo "==> Pulling model: ${MODEL}"
ollama pull "${MODEL}"

echo "==> Configuring Ollama keep-alive (${KEEP_ALIVE})"
mkdir -p /etc/systemd/system/ollama.service.d
tee /etc/systemd/system/ollama.service.d/override.conf >/dev/null <<EOF
[Service]
Environment="OLLAMA_KEEP_ALIVE=${KEEP_ALIVE}"
EOF

systemctl daemon-reload
systemctl enable ollama
systemctl restart ollama

echo "==> Waiting for Ollama API..."
wait_for_ollama

echo "==> Warming model in memory"
ollama run "${MODEL}" "LeBorg James" >/dev/null

echo "==> Done."
curl -s http://127.0.0.1:11434/api/tags
echo
systemctl status ollama --no-pager -l | head -15
