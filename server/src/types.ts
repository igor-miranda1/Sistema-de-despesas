import type { RowDataPacket } from 'mysql2';

export interface Categoria {
  id: number;
  nome: string;
}

export interface Despesa {
  id: string;
  titulo: string;
  valor: number;
  data: string;
  categoriaId: number;
  categoria: string;
}

export interface DespesaRow extends RowDataPacket {
  id: string;
  titulo: string;
  valor: string;
  data: string;
  categoriaId: number;
  categoria: string;
}

export interface CategoriaRow extends RowDataPacket {
  id: number;
  nome: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
}

export interface UsuarioRow extends Usuario, RowDataPacket {
  senha_hash: string;
  token_version: number;
  email_verificado_em: string | null;
}

export interface Orcamento {
  categoriaId: number;
  limite: number;
}

export interface OrcamentoRow extends RowDataPacket {
  categoriaId: number;
  limite: string;
}

export interface Receita {
  id: string;
  titulo: string;
  valor: number;
  data: string;
}

export interface ReceitaRow extends RowDataPacket {
  id: string;
  titulo: string;
  valor: string;
  data: string;
}

export interface ResumoMensalRow extends RowDataPacket {
  mes: string;
  total: string;
}

export interface ResumoMensal {
  mes: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

export interface DadosDespesa {
  titulo: string;
  valor: number;
  data: string;
  categoriaId: number;
}

export interface DadosReceita {
  titulo: string;
  valor: number;
  data: string;
}

export interface DadosCadastro {
  nome: string;
  email: string;
  senha: string;
}

export interface DadosLogin {
  email: string;
  senha: string;
}
