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

export interface Usuario {
  id: string;
  nome: string;
  email: string;
}

export interface Orcamento {
  categoriaId: number;
  limite: number;
}

export interface Receita {
  id: string;
  titulo: string;
  valor: number;
  data: string;
}

export interface ResumoMensal {
  mes: string;
  receitas: number;
  despesas: number;
  saldo: number;
}
