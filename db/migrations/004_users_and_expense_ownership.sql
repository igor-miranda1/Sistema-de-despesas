CREATE TABLE usuarios (
  id CHAR(36) NOT NULL PRIMARY KEY,
  nome VARCHAR(80) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

DELETE FROM despesas;

ALTER TABLE despesas
  ADD COLUMN usuario_id CHAR(36) NULL AFTER categoria_id;

ALTER TABLE despesas
  MODIFY COLUMN usuario_id CHAR(36) NOT NULL,
  ADD INDEX idx_despesas_usuario_data (usuario_id, data),
  ADD CONSTRAINT fk_despesas_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
