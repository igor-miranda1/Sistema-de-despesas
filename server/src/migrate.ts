import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RowDataPacket } from 'mysql2';
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

const migrationsDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../db/migrations',
);

export async function runMigrations(): Promise<void> {
  const connection = await mysql.createConnection({
    host: requiredEnvironmentVariable('MYSQL_HOST'),
    port,
    user: requiredEnvironmentVariable('DB_MIGRATOR_USER'),
    password: requiredEnvironmentVariable('DB_MIGRATOR_PASSWORD'),
    database: requiredEnvironmentVariable('MYSQL_DATABASE'),
    multipleStatements: true,
    dateStrings: true,
  });

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nome VARCHAR(255) NOT NULL PRIMARY KEY,
        aplicada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    const [appliedRows] = await connection.query<Array<RowDataPacket & { nome: string }>>(
      'SELECT nome FROM schema_migrations',
    );
    const applied = new Set(appliedRows.map((row) => row.nome));
    const files = (await readdir(migrationsDirectory))
      .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/i.test(file))
      .sort((left, right) => left.localeCompare(right));

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = await readFile(resolve(migrationsDirectory, file), 'utf8');
      await connection.query(sql);
      await connection.execute('INSERT INTO schema_migrations (nome) VALUES (?)', [file]);
      console.log(`Migration aplicada: ${file}`);
    }
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMigrations().catch((error: unknown) => {
    console.error('Falha ao executar migrations:', error);
    process.exitCode = 1;
  });
}
