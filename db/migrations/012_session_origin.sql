ALTER TABLE sessoes
  ADD COLUMN endereco_ip VARCHAR(45) NULL AFTER usuario_id,
  ADD COLUMN user_agent VARCHAR(255) NULL AFTER endereco_ip;
