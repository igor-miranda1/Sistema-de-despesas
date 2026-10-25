CREATE TABLE sessoes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  usuario_id CHAR(36) NOT NULL,
  criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acesso_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em TIMESTAMP NOT NULL,
  revogada_em TIMESTAMP NULL,
  CONSTRAINT fk_sessoes_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_sessoes_usuario (usuario_id, revogada_em),
  INDEX idx_sessoes_expiracao (expira_em)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
