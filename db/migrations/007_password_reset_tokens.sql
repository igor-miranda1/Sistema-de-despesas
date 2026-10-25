CREATE TABLE password_reset_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  usuario_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expira_em TIMESTAMP NOT NULL,
  usado_em TIMESTAMP NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_password_reset_lookup (usuario_id, token_hash),
  INDEX idx_password_reset_expiration (expira_em)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
