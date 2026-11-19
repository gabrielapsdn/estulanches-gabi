/**
 * Regras de negócio puras (sem banco/HTTP) -> testáveis por testes unitários.
 */

const STATUS_FLUXO = {
  RECEBIDO: ['EM_PREPARO', 'CANCELADO'],
  EM_PREPARO: ['PRONTO', 'CANCELADO'],
  PRONTO: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADO: []
};

class ErroValidacao extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroValidacao';
  }
}

function validarItemCardapio(dados = {}) {
  const nome = String(dados.nome || '').trim();
  if (nome.length < 2) {
    throw new ErroValidacao('nome deve ter ao menos 2 caracteres');
  }

  const preco = Number(dados.preco);
  if (isNaN(preco) || dados.preco === null || dados.preco === undefined || dados.preco === '') {
    throw new ErroValidacao('preco inválido');
  }

  if (preco <= 0) {
    throw new ErroValidacao('preco deve ser maior que zero');
  }

  return {
    nome,
    preco: Math.round(preco * 100) / 100
  };
}

function calcularTotal(itens = []) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new ErroValidacao('pedido sem itens');
  }

  let totalCentavos = 0;
  for (const item of itens) {
    const qtd = parseInt(item.quantidade, 10);
    if (isNaN(qtd) || qtd <= 0) {
      throw new ErroValidacao('quantidade deve ser maior que zero');
    }

    const preco = Number(item.preco);
    if (isNaN(preco) || preco <= 0) {
      throw new ErroValidacao('preco inválido no item');
    }

    totalCentavos += Math.round(preco * 100) * qtd;
  }

  return Math.round(totalCentavos) / 100;
}

function transicaoValida(atual, novo) {
  const permitidos = STATUS_FLUXO[atual] || [];
  return permitidos.includes(novo);
}

module.exports = {
  STATUS_FLUXO,
  ErroValidacao,
  validarItemCardapio,
  calcularTotal,
  transicaoValida
};
