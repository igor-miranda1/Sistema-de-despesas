import 'dotenv/config';
import mysql from 'mysql2/promise';

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }

  return value;
}

const port = Number(process.env.MYSQL_PORT || '3306');

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('MYSQL_PORT deve ser uma porta válida.');
}

export const pool = mysql.createPool({
  host: requiredEnvironmentVariable('MYSQL_HOST'),
  port,
  user: requiredEnvironmentVariable('DB_APP_USER'),
  password: requiredEnvironmentVariable('DB_APP_PASSWORD'),
  database: requiredEnvironmentVariable('MYSQL_DATABASE'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 100,
  connectTimeout: 5000,
  multipleStatements: false,
  dateStrings: true,
});
