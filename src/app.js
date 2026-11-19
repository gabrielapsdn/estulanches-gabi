const express = require('express');
const { createDatabase } = require('./db');
const {
  ErroValidacao,
  validarItemCardapio,
  calcularTotal,
  transicaoValida
} = require('./services');

const VERSAO = process.env.APP_VERSION || '1.0.0';

function createApp(dbInstance) {
  const app = express();
  app.use(express.json());

  const db = dbInstance || createDatabase();
  app.locals.db = db;

  // Endpoint de Healthcheck (valida app e conexão com banco)
  app.get('/health', async (req, res, next) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok', versao: VERSAO });
    } catch (err) {
      next(err);
    }
  });

  // Cardápio: Listagem
  app.get('/cardapio', async (req, res, next) => {
    try {
      const result = await db.query(
        'SELECT id, nome, preco FROM cardapio WHERE disponivel = $1 ORDER BY id',
        [true]
      );
      const itens = result.rows.map(r => {
        const row = Array.isArray(r) ? r : [r.id, r.nome, r.preco];
        return { id: row[0], nome: row[1], preco: Number(row[2]) };
      });
      res.json(itens);
    } catch (err) {
      next(err);
    }
  });

  // Cardápio: Cadastro
  app.post('/cardapio', async (req, res, next) => {
    try {
      const dados = validarItemCardapio(req.body);
      const result = await db.query(
        'INSERT INTO cardapio (nome, preco) VALUES ($1, $2) RETURNING id',
        [dados.nome, dados.preco]
      );
      const row = result.rows[0];
      const id = Array.isArray(row) ? row[0] : row.id;
      res.status(201).json({ id, nome: dados.nome, preco: dados.preco });
    } catch (err) {
      next(err);
    }
  });

  // Pedidos: Criação
  app.post('/pedidos', async (req, res, next) => {
    try {
      const body = req.body || {};
      const aluno = String(body.aluno || '').trim();
      if (!aluno) {
        throw new ErroValidacao('aluno é obrigatório');
      }

      const itensRecebidos = Array.isArray(body.itens) ? body.itens : [];
      if (itensRecebidos.length === 0) {
        throw new ErroValidacao('pedido sem itens');
      }

      const itensCompletos = [];
      for (const it of itensRecebidos) {
        const itemRes = await db.query(
          'SELECT id, preco FROM cardapio WHERE id = $1 AND disponivel = $2',
          [it.item_id, true]
        );
        if (!itemRes.rows || itemRes.rows.length === 0) {
          throw new ErroValidacao(`item ${it.item_id} inexistente`);
        }
        const row = itemRes.rows[0];
        const itemId = Array.isArray(row) ? row[0] : row.id;
        const preco = Array.isArray(row) ? row[1] : row.preco;

        itensCompletos.push({
          item_id: itemId,
          preco: Number(preco),
          quantidade: it.quantidade
        });
      }

      const total = calcularTotal(itensCompletos);

      const pedidoRes = await db.query(
        'INSERT INTO pedidos (aluno, total) VALUES ($1, $2) RETURNING id',
        [aluno, total]
      );
      const rowPed = pedidoRes.rows[0];
      const pid = Array.isArray(rowPed) ? rowPed[0] : rowPed.id;

      for (const it of itensCompletos) {
        await db.query(
          'INSERT INTO pedido_itens (pedido_id, item_id, quantidade) VALUES ($1, $2, $3)',
          [pid, it.item_id, parseInt(it.quantidade, 10)]
        );
      }

      res.status(201).json({
        id: pid,
        aluno,
        status: 'RECEBIDO',
        total
      });
    } catch (err) {
      next(err);
    }
  });

  // Pedidos: Consulta por ID
  app.get('/pedidos/:id', async (req, res, next) => {
    try {
      const pid = parseInt(req.params.id, 10);
      const result = await db.query(
        'SELECT id, aluno, status, total FROM pedidos WHERE id = $1',
        [pid]
      );
      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ erro: 'pedido não encontrado' });
      }
      const row = result.rows[0];
      const id = Array.isArray(row) ? row[0] : row.id;
      const aluno = Array.isArray(row) ? row[1] : row.aluno;
      const status = Array.isArray(row) ? row[2] : row.status;
      const total = Array.isArray(row) ? row[3] : row.total;

      res.json({ id, aluno, status, total: Number(total) });
    } catch (err) {
      next(err);
    }
  });

  // Pedidos: Atualização de Status
  app.patch('/pedidos/:id/status', async (req, res, next) => {
    try {
      const pid = parseInt(req.params.id, 10);
      const novoStatus = req.body && req.body.status;

      const result = await db.query('SELECT status FROM pedidos WHERE id = $1', [pid]);
      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ erro: 'pedido não encontrado' });
      }

      const row = result.rows[0];
      const statusAtual = Array.isArray(row) ? row[0] : row.status;

      if (!transicaoValida(statusAtual, novoStatus)) {
        return res.status(409).json({
          erro: `transição ${statusAtual} -> ${novoStatus} não permitida`
        });
      }

      await db.query('UPDATE pedidos SET status = $1 WHERE id = $2', [novoStatus, pid]);
      res.json({ id: pid, status: novoStatus });
    } catch (err) {
      next(err);
    }
  });

  // Middleware de tratamento de erros
  app.use((err, req, res, next) => {
    if (err instanceof ErroValidacao) {
      return res.status(400).json({ erro: err.message });
    }
    console.error('[ERRO_INTERNO]', err);
    res.status(500).json({ erro: 'erro interno do servidor' });
  });

  return app;
}

// Inicialização standalone (quando iniciado via `node src/app.js`)
if (require.main === module) {
  const PORT = process.env.PORT || 8000;
  const db = createDatabase();

  db.waitAndInit()
    .then(() => {
      const app = createApp(db);
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[estulanches] Servidor Express ouvindo na porta ${PORT} (v${VERSAO})`);
      });
    })
    .catch(err => {
      console.error('[FATAL] Falha ao conectar ao banco de dados:', err);
      process.exit(1);
    });
}

module.exports = {
  createApp
};
