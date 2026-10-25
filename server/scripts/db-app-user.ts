import 'dotenv/config';
import mysql from 'mysql2/promise';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function quoteIdentifier(value: string): string {
  return `\`${value.replace(/`/g, '``')}\``;
}

const connection = await mysql.createConnection({
  host: required('MYSQL_HOST'),
  port: Number(process.env.MYSQL_PORT || '3306'),
  user: 'root',
  password: required('MYSQL_ROOT_PASSWORD'),
  database: required('MYSQL_DATABASE'),
});

try {
  const user = required('DB_APP_USER').replace(/'/g, "''");
  const password = required('DB_APP_PASSWORD').replace(/'/g, "''");
  const database = quoteIdentifier(required('MYSQL_DATABASE'));
  await connection.query(
    `CREATE USER IF NOT EXISTS '${user}'@'%' IDENTIFIED BY '${password}'`,
  );
  await connection.query(`ALTER USER '${user}'@'%' IDENTIFIED BY '${password}'`);
  await connection.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${database}.* TO '${user}'@'%'`,
  );
  await connection.query('FLUSH PRIVILEGES');
  console.log('Usuário da aplicação configurado com privilégios DML.');
} finally {
  await connection.end();
}
