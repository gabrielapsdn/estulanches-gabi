/**
 * Camada de acesso ao banco de dados.
 * Em produção: PostgreSQL (pg).
 * Em testes locais (sem banco): Memória (para testes rápidos e isolados).
 */
const { Pool } = require('pg');

const SCHEMA_PG = `
CREATE TABLE IF NOT EXISTS cardapio (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(80) NOT NULL,
  preco NUMERIC(8,2) NOT NULL,
  disponivel BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  aluno VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'RECEBIDO',
  total NUMERIC(8,2) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedido_itens (
  id SERIAL PRIMARY KEY,
  pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  item_id INT NOT NULL REFERENCES cardapio(id),
  quantidade INT NOT NULL CHECK (quantidade > 0)
);
`;

class MemoryDatabase {
  constructor() {
    this.cardapio = [];
    this.pedidos = [];
    this.pedidoItens = [];
    this.nextCardapioId = 1;
    this.nextPedidoId = 1;
    this.nextPedidoItemId = 1;
  }

  async waitAndInit() {
    console.log('[db:memory] banco em memória inicializado');
  }

  async query(text, params = []) {
    const q = text.trim().toUpperCase();

    if (q === 'SELECT 1') {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }

    if (q.startsWith('SELECT ID, NOME, PRECO FROM CARDAPIO')) {
      const rows = this.cardapio
        .filter(c => c.disponivel === true)
        .map(c => [c.id, c.nome, c.preco]);
      return { rows, rowCount: rows.length };
    }

    if (q.startsWith('SELECT ID, PRECO FROM CARDAPIO WHERE ID = $1 AND DISPONIVEL = $2')) {
      const item = this.cardapio.find(c => c.id === params[0] && c.disponivel === params[1]);
      const rows = item ? [[item.id, item.preco]] : [];
      return { rows, rowCount: rows.length };
    }

    if (q.startsWith('INSERT INTO CARDAPIO')) {
      const id = this.nextCardapioId++;
      const item = { id, nome: params[0], preco: Number(params[1]), disponivel: true };
      this.cardapio.push(item);
      return { rows: [{ id }], rowCount: 1 };
    }

    if (q.startsWith('INSERT INTO PEDIDOS')) {
      const id = this.nextPedidoId++;
      const pedido = { id, aluno: params[0], total: Number(params[1]), status: 'RECEBIDO', criado_em: new Date() };
      this.pedidos.push(pedido);
      return { rows: [{ id }], rowCount: 1 };
    }

    if (q.startsWith('INSERT INTO PEDIDO_ITENS')) {
      const id = this.nextPedidoItemId++;
      this.pedidoItens.push({ id, pedido_id: params[0], item_id: params[1], quantidade: params[2] });
      return { rows: [{ id }], rowCount: 1 };
    }

    if (q.startsWith('SELECT ID, ALUNO, STATUS, TOTAL FROM PEDIDOS WHERE ID = $1')) {
      const pedido = this.pedidos.find(p => p.id === params[0]);
      const rows = pedido ? [[pedido.id, pedido.aluno, pedido.status, pedido.total]] : [];
      return { rows, rowCount: rows.length };
    }

    if (q.startsWith('SELECT STATUS FROM PEDIDOS WHERE ID = $1')) {
      const pedido = this.pedidos.find(p => p.id === params[0]);
      const rows = pedido ? [[pedido.status]] : [];
      return { rows, rowCount: rows.length };
    }

    if (q.startsWith('UPDATE PEDIDOS SET STATUS = $1 WHERE ID = $2')) {
      const pedido = this.pedidos.find(p => p.id === params[1]);
      if (pedido) pedido.status = params[0];
      return { rows: [], rowCount: pedido ? 1 : 0 };
    }

    throw new Error(`Query não suportada no mock em memória: ${text}`);
  }

  async close() {}
}

class PostgresDatabase {
  constructor(connectionString) {
    this.pool = new Pool({ connectionString });
  }

  async waitAndInit(tentativas = 30, esperaMs = 2000) {
    for (let i = 1; i <= tentativas; i++) {
      try {
        const client = await this.pool.connect();
        try {
          await client.query(SCHEMA_PG);
          console.log('[db] conexão estabelecida com PostgreSQL e schema aplicado');
          return;
        } finally {
          client.release();
        }
      } catch (err) {
        console.log(`[db] tentativa ${i}/${tentativas} falhou: ${err.message}`);
        await new Promise(r => setTimeout(r, esperaMs));
      }
    }
    throw new Error('Banco de dados PostgreSQL indisponível após limite de tentativas');
  }

  async query(text, params = []) {
    return this.pool.query(text, params);
  }

  async close() {
    await this.pool.end();
  }
}

function createDatabase(url) {
  const dbUrl = url || process.env.DATABASE_URL || 'memory://';
  if (dbUrl.startsWith('postgres')) {
    return new PostgresDatabase(dbUrl);
  }
  return new MemoryDatabase();
}

module.exports = {
  createDatabase,
  SCHEMA_PG
};
