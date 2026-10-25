CREATE TABLE receitas (
  id CHAR(36) NOT NULL PRIMARY KEY,
  usuario_id CHAR(36) NOT NULL,
  titulo VARCHAR(120) NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  data DATE NOT NULL,
  criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_receitas_usuario_data (usuario_id, data),
  CONSTRAINT chk_receitas_valor_positivo CHECK (valor > 0),
  CONSTRAINT fk_receitas_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
