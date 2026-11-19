const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  ErroValidacao,
  validarItemCardapio,
  calcularTotal,
  transicaoValida
} = require('../src/services');

describe('Testes Unitários - Regras de Negócio do EstuLanches', () => {
  it('deve calcular o total somando os itens corretamente', () => {
    const itens = [
      { preco: '5.50', quantidade: 2 },
      { preco: '3.00', quantidade: 1 }
    ];
    assert.equal(calcularTotal(itens), 14.00);
  });

  it('deve rejeitar pedido sem itens', () => {
    assert.throws(() => calcularTotal([]), ErroValidacao);
  });

  it('deve rejeitar quantidade inválida (<= 0)', () => {
    assert.throws(() => calcularTotal([{ preco: '5', quantidade: 0 }]), ErroValidacao);
  });

  it('deve normalizar preço e nome de item válido', () => {
    const res = validarItemCardapio({ nome: ' Coxinha ', preco: '6.5' });
    assert.deepEqual(res, { nome: 'Coxinha', preco: 6.50 });
  });

  it('deve rejeitar item com preço negativo', () => {
    assert.throws(() => validarItemCardapio({ nome: 'Suco', preco: -1 }), ErroValidacao);
  });

  it('deve rejeitar item com nome curto (< 2 caracteres)', () => {
    assert.throws(() => validarItemCardapio({ nome: 'a', preco: 3 }), ErroValidacao);
  });

  it('deve validar o fluxo de transição de status de pedidos', () => {
    assert.equal(transicaoValida('RECEBIDO', 'EM_PREPARO'), true);
    assert.equal(transicaoValida('RECEBIDO', 'ENTREGUE'), false);
    assert.equal(transicaoValida('ENTREGUE', 'CANCELADO'), false);
  });
});
