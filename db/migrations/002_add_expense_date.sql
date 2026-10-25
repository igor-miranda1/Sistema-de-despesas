ALTER TABLE despesas
  ADD COLUMN data DATE NULL AFTER valor;

UPDATE despesas
SET data = DATE(criada_em)
WHERE data IS NULL;

ALTER TABLE despesas
  MODIFY COLUMN data DATE NOT NULL,
  ADD INDEX idx_despesas_data (data);
