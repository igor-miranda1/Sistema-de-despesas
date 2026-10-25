#!/bin/sh
set -eu

escape_sql() {
  printf "%s" "$1" | sed "s/'/''/g"
}

app_user="$(escape_sql "${DB_APP_USER}")"
app_password="$(escape_sql "${DB_APP_PASSWORD}")"
migrator_user="$(escape_sql "${DB_MIGRATOR_USER}")"
migrator_password="$(escape_sql "${DB_MIGRATOR_PASSWORD}")"
database="$(escape_sql "${MYSQL_DATABASE}")"

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS '${app_user}'@'%' IDENTIFIED BY '${app_password}';
ALTER USER '${app_user}'@'%' IDENTIFIED BY '${app_password}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${database}\`.* TO '${app_user}'@'%';
CREATE USER IF NOT EXISTS '${migrator_user}'@'%' IDENTIFIED BY '${migrator_password}';
ALTER USER '${migrator_user}'@'%' IDENTIFIED BY '${migrator_password}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON \`${database}\`.* TO '${migrator_user}'@'%';
FLUSH PRIVILEGES;
SQL
