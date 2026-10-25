SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS despesas (
  id CHAR(36) NOT NULL PRIMARY KEY,
  titulo VARCHAR(120) NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  categoria ENUM(
    'alimento',
    'Transporte',
    'Lazer',
    'Saúde',
    'Investimento',
    'outros',
    'moradia',
    'contas',
    'educacao',
    'assinaturas'
  ) NOT NULL,
  criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_despesas_valor_positivo CHECK (valor > 0)
) CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
