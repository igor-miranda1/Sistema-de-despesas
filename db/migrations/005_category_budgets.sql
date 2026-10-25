CREATE TABLE orcamentos (
  usuario_id CHAR(36) NOT NULL,
  categoria_id INT NOT NULL,
  limite DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY (usuario_id, categoria_id),
  INDEX idx_orcamentos_categoria (categoria_id),
  CONSTRAINT chk_orcamentos_limite_positivo CHECK (limite > 0),
  CONSTRAINT fk_orcamentos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_orcamentos_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
