#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Uso: $0 backups/arquivo.sql.gz" >&2
  exit 1
fi

gzip -dc "$1" | docker compose -f docker-compose.prod.yml exec -T mysql \
  mysql -u"${DB_APP_USER}" -p"${DB_APP_PASSWORD}" "${MYSQL_DATABASE}"
