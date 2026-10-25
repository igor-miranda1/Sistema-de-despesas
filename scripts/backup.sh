#!/bin/sh
set -eu

mkdir -p backups
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
docker compose -f docker-compose.prod.yml exec -T mysql \
  mysqldump --single-transaction --quick --no-tablespaces \
  -u"${DB_APP_USER}" -p"${DB_APP_PASSWORD}" "${MYSQL_DATABASE}" |
  gzip > "backups/despesas-${timestamp}.sql.gz"
echo "Backup criado em backups/despesas-${timestamp}.sql.gz"
