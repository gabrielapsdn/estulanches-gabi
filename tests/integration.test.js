const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
const { createApp } = require('../src/app');
const { createDatabase } = require('../src/db');

// Cliente de teste in-process (sem abrir portas TCP, 100% determinístico e veloz)
function request(app, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve) => {
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

    const req = new Readable({
      read() {
        if (payload) {
          this.push(payload);
        }
        this.push(null);
      }
    });

    req.method = method;
    req.url = url;
    req.headers = {
      'content-type': 'application/json',
      ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
      ...headers
    };

    let statusCode = 200;
    const resHeaders = {};
    const chunks = [];

    const res = new EventEmitter();
    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.writeHead = (code, h) => {
      statusCode = code;
      if (h) {
        for (const [k, v] of Object.entries(h)) {
          resHeaders[k.toLowerCase()] = v;
        }
      }
    };
    Object.defineProperty(res, 'statusCode', {
      get: () => statusCode,
      set: (c) => { statusCode = c; }
    });
    res.write = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const text = Buffer.concat(chunks).toString('utf8');
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (_) {}
      resolve({
        status: statusCode,
        headers: resHeaders,
        text,
        json: async () => parsed
      });
    };

    app.handle(req, res);
  });
}

describe('Testes de Integração - API HTTP e Persistência do EstuLanches', () => {
  let app;
  let db;

  before(async () => {
    const testDbUrl = process.env.TEST_DATABASE_URL || 'memory://';
    db = createDatabase(testDbUrl);
    await db.waitAndInit();
    app = createApp(db);
  });

  after(async () => {
    if (db) {
      await db.close();
    }
  });

  it('deve responder status 200 no endpoint /health', async () => {
    const res = await request(app, { method: 'GET', url: '/health' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });

  it('deve executar o fluxo completo de cadastro, pedido e transições de status', async () => {
    // 1. Cadastra dois itens no cardápio
    const resA = await request(app, {
      method: 'POST',
      url: '/cardapio',
      body: { nome: 'Coxinha', preco: 6.5 }
    });
    assert.equal(resA.status, 201);
    const itemA = await resA.json();

    const resB = await request(app, {
      method: 'POST',
      url: '/cardapio',
      body: { nome: 'Suco', preco: 4 }
    });
    assert.equal(resB.status, 201);
    const itemB = await resB.json();

    // 2. Consulta cardápio
    const resCardapio = await request(app, { method: 'GET', url: '/cardapio' });
    assert.equal(resCardapio.status, 200);
    const cardapio = await resCardapio.json();
    assert.ok(cardapio.length >= 2);

    // 3. Cria pedido: 2 Coxinhas (13.00) + 1 Suco (4.00) = 17.00
    const resPedido = await request(app, {
      method: 'POST',
      url: '/pedidos',
      body: {
        aluno: 'Ana',
        itens: [
          { item_id: itemA.id, quantidade: 2 },
          { item_id: itemB.id, quantidade: 1 }
        ]
      }
    });
    assert.equal(resPedido.status, 201);
    const pedido = await resPedido.json();
    assert.equal(pedido.total, 17.0);
    assert.equal(pedido.status, 'RECEBIDO');

    const pid = pedido.id;

    // 4. Atualiza status pelo fluxo permitido: RECEBIDO -> EM_PREPARO -> PRONTO -> ENTREGUE
    for (const novoStatus of ['EM_PREPARO', 'PRONTO', 'ENTREGUE']) {
      const resStatus = await request(app, {
        method: 'PATCH',
        url: `/pedidos/${pid}/status`,
        body: { status: novoStatus }
      });
      assert.equal(resStatus.status, 200);
      const jsonStatus = await resStatus.json();
      assert.equal(jsonStatus.status, novoStatus);
    }

    // 5. Verifica se o pedido persiste com status ENTREGUE
    const resConsulta = await request(app, { method: 'GET', url: `/pedidos/${pid}` });
    assert.equal(resConsulta.status, 200);
    const pedidoFinal = await resConsulta.json();
    assert.equal(pedidoFinal.status, 'ENTREGUE');
  });

  it('deve retornar 409 ao tentar transição de status inválida', async () => {
    const resA = await request(app, {
      method: 'POST',
      url: '/cardapio',
      body: { nome: 'Pão de Queijo', preco: 3 }
    });
    const itemA = await resA.json();

    const resPed = await request(app, {
      method: 'POST',
      url: '/pedidos',
      body: {
        aluno: 'Beto',
        itens: [{ item_id: itemA.id, quantidade: 1 }]
      }
    });
    const pedido = await resPed.json();

    // Tentar pular de RECEBIDO direto para ENTREGUE não é permitido
    const resPulo = await request(app, {
      method: 'PATCH',
      url: `/pedidos/${pedido.id}/status`,
      body: { status: 'ENTREGUE' }
    });
    assert.equal(resPulo.status, 409);
  });

  it('deve retornar 400 ao tentar criar pedido com item inexistente', async () => {
    const res = await request(app, {
      method: 'POST',
      url: '/pedidos',
      body: {
        aluno: 'Caio',
        itens: [{ item_id: 99999, quantidade: 1 }]
      }
    });
    assert.equal(res.status, 400);
  });

  it('deve retornar 404 ao consultar pedido inexistente', async () => {
    const res = await request(app, { method: 'GET', url: '/pedidos/99999' });
    assert.equal(res.status, 404);
  });
});
