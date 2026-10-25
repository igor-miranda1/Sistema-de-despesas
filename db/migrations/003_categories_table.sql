CREATE TABLE categorias (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(40) NOT NULL UNIQUE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO categorias (nome)
VALUES
  ('Alimentação'),
  ('Transporte'),
  ('Lazer'),
  ('Saúde'),
  ('Investimento'),
  ('Moradia'),
  ('Contas'),
  ('Educação'),
  ('Assinaturas'),
  ('Outros');

ALTER TABLE despesas
  ADD COLUMN categoria_id INT NULL AFTER categoria;

UPDATE despesas d
JOIN categorias c
  ON c.nome = CASE d.categoria
    WHEN 'alimento' THEN 'Alimentação'
    WHEN 'outros' THEN 'Outros'
    WHEN 'moradia' THEN 'Moradia'
    WHEN 'contas' THEN 'Contas'
    WHEN 'educacao' THEN 'Educação'
    WHEN 'assinaturas' THEN 'Assinaturas'
    ELSE d.categoria
  END
SET d.categoria_id = c.id;

ALTER TABLE despesas
  MODIFY COLUMN categoria_id INT NOT NULL,
  ADD INDEX idx_despesas_categoria_id (categoria_id),
  ADD CONSTRAINT fk_despesas_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  DROP COLUMN categoria;
