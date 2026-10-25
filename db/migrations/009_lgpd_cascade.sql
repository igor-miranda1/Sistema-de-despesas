ALTER TABLE despesas DROP FOREIGN KEY fk_despesas_usuario;
ALTER TABLE despesas
  ADD CONSTRAINT fk_despesas_usuario
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;

ALTER TABLE receitas DROP FOREIGN KEY fk_receitas_usuario;
ALTER TABLE receitas
  ADD CONSTRAINT fk_receitas_usuario
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;

ALTER TABLE orcamentos DROP FOREIGN KEY fk_orcamentos_usuario;
ALTER TABLE orcamentos
  ADD CONSTRAINT fk_orcamentos_usuario
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
