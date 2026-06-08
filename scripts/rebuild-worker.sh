#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

COMPOSE_FILE="${WORKER_COMPOSE_FILE:-}"
WORKER_SERVICE="${WORKER_SERVICE:-worker}"
LOG_TAIL="${WORKER_LOG_TAIL:-40}"

if [ -z "$COMPOSE_FILE" ]; then
  if [ -f docker-compose.worker.yml ]; then
    COMPOSE_FILE="docker-compose.worker.yml"
  else
    COMPOSE_FILE="docker-compose.yml"
  fi
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Missing $COMPOSE_FILE" >&2
  exit 1
fi

echo "Rebuilding and restarting $WORKER_SERVICE with $COMPOSE_FILE..."
docker compose -f "$COMPOSE_FILE" up -d --build --force-recreate "$WORKER_SERVICE"

echo
docker compose -f "$COMPOSE_FILE" ps "$WORKER_SERVICE"

echo
docker compose -f "$COMPOSE_FILE" logs --tail="$LOG_TAIL" "$WORKER_SERVICE"
