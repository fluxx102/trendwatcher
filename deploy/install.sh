#!/usr/bin/env bash
# Trendwatcher — установка и запуск на своём сервере одной командой (Ubuntu/Debian).
# Повторный запуск = обновление до последней версии.
set -euo pipefail
REPO="https://github.com/fluxx102/trendwatcher.git"
BRANCH="claude/nifty-bell-84tqkk"
DIR="${TW_DIR:-$HOME/trendwatcher}"
PORT="${PORT:-3000}"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
say() { printf "\n\033[1;32m▶ %s\033[0m\n" "$*"; }

say "1/6 Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
fi
command -v git >/dev/null || $SUDO apt-get install -y git
node -v

say "2/6 Код проекта → $DIR"
if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" reset -q --hard "origin/$BRANCH"
else git clone -q -b "$BRANCH" "$REPO" "$DIR"; fi
cd "$DIR"

say "3/6 Ключи (.env)"
if [ ! -f .env ] || ! grep -q '^TAVILY_API_KEY=.\+' .env || ! grep -q '^LLM_API_KEY=.\+' .env; then
  cp .env.example .env
  T="${TAVILY_API_KEY:-}"; L="${LLM_API_KEY:-}"
  [ -z "$T" ] && { read -rsp "Вставьте ключ Tavily (tvly-...), ввод скрыт: " T </dev/tty; echo; }
  [ -z "$L" ] && { read -rsp "Вставьте ключ Groq (gsk_...), ввод скрыт: " L </dev/tty; echo; }
  sed -i "s|^TAVILY_API_KEY=.*|TAVILY_API_KEY=$T|; s|^LLM_API_KEY=.*|LLM_API_KEY=$L|" .env
  chmod 600 .env
fi
echo "ключи сохранены в $DIR/.env (доступ только владельцу)"

say "4/6 Установка зависимостей и сборка (2–4 минуты)"
npm ci --no-audit --no-fund --loglevel=error
npm run build >/dev/null
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true

say "5/6 Запуск как системной службы (автоперезапуск, старт при загрузке)"
NODE_BIN="$(command -v node)"
$SUDO tee /etc/systemd/system/trendwatcher.service >/dev/null <<UNIT
[Unit]
Description=Trendwatcher
After=network-online.target
[Service]
WorkingDirectory=$DIR/.next/standalone
EnvironmentFile=$DIR/.env
Environment=NODE_ENV=production PORT=$PORT HOSTNAME=0.0.0.0
ExecStart=$NODE_BIN server.js
Restart=always
User=$(id -un)
[Install]
WantedBy=multi-user.target
UNIT
$SUDO systemctl daemon-reload
$SUDO systemctl enable --now trendwatcher >/dev/null 2>&1
$SUDO systemctl restart trendwatcher
command -v ufw >/dev/null && $SUDO ufw status | grep -q "Status: active" && $SUDO ufw allow "$PORT"/tcp >/dev/null || true

say "6/6 Проверка"
for i in $(seq 1 20); do curl -fs "http://127.0.0.1:$PORT/api/status" >/dev/null && break; sleep 1; done
STATUS="$(curl -s "http://127.0.0.1:$PORT/api/status" || true)"
echo "$STATUS"
IP="$(curl -s -4 --max-time 5 https://ifconfig.me || hostname -I | awk '{print $1}')"
if echo "$STATUS" | grep -q '"available":true'; then
  printf "\n\033[1;32m✅ Готово! Откройте: http://%s:%s\033[0m\n" "$IP" "$PORT"
else
  printf "\n\033[1;31m⚠ Сервис запущен, но реальный поиск недоступен. Проверьте ключи: nano %s/.env, затем sudo systemctl restart trendwatcher\033[0m\n" "$DIR"
fi
echo "Логи: sudo journalctl -u trendwatcher -n 50 --no-pager"
echo "Если сайт не открывается снаружи — откройте порт $PORT в панели хостинга (firewall / security group)."
