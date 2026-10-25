ALTER TABLE usuarios
  ADD COLUMN email_verificado_em TIMESTAMP NULL AFTER email;

ALTER TABLE password_reset_tokens
  ADD COLUMN finalidade VARCHAR(20) NOT NULL DEFAULT 'recuperacao' AFTER usuario_id,
  ADD COLUMN codigo_hmac CHAR(64) NULL AFTER token_hash,
  ADD COLUMN tentativas TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER expira_em;

UPDATE password_reset_tokens
SET codigo_hmac = token_hash
WHERE codigo_hmac IS NULL;

ALTER TABLE password_reset_tokens
  MODIFY COLUMN codigo_hmac CHAR(64) NOT NULL,
  DROP INDEX idx_password_reset_lookup,
  ADD INDEX idx_password_reset_lookup (usuario_id, finalidade, codigo_hmac),
  ADD INDEX idx_password_reset_active (usuario_id, finalidade, usado_em, expira_em);
