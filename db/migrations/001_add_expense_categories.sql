ALTER TABLE despesas
  MODIFY categoria ENUM(
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
  ) NOT NULL;
