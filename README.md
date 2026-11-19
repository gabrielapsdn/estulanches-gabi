# EstuLanches — gestão de cardápio e pedidos da cantina escolar

**Aluna / Técnica de Implantação:** Gabriela do Nascimento  
**Turma:** 3B  
**Atividade:** Situação de Aprendizagem (SA) — Implantação em Produção com Docker

Stack: Python 3.12 + Flask (API REST) + Gunicorn · PostgreSQL 16 · Docker / Docker Compose.

## Subir em produção
```bash
cp .env.example .env        # edite POSTGRES_PASSWORD
docker compose up -d --build
docker compose ps           # estado dos serviços e portas (db e app "healthy")
docker compose logs db app  # auditar logs de inicialização (sem ERROR/FATAL)
curl http://localhost:8000/health
```

## Testes
```bash
# Unitários + integração (SQLite, sem Docker)
python -m unittest discover -s tests -v

# Integração contra o PostgreSQL real do compose
docker compose --profile test run --rm tests
```

## Endpoints
| Método | Rota | Função |
|---|---|---|
| GET | /health | verifica app + banco |
| GET/POST | /cardapio | lista / cadastra item |
| POST | /pedidos | cria pedido (calcula total) |
| GET | /pedidos/{id} | consulta pedido |
| PATCH | /pedidos/{id}/status | RECEBIDO → EM_PREPARO → PRONTO → ENTREGUE (ou CANCELADO) |

Exemplo:
```bash
curl -X POST localhost:8000/cardapio -H 'Content-Type: application/json' -d '{"nome":"Coxinha","preco":6.5}'
curl -X POST localhost:8000/pedidos  -H 'Content-Type: application/json' -d '{"aluno":"Ana","itens":[{"item_id":1,"quantidade":2}]}'
```

## Decisões de arquitetura
- **Regras de negócio isoladas** em `services.py` (puras) → testes unitários rápidos.
- **Camada de dados** em `db.py`: PostgreSQL em produção, SQLite em testes locais.
- **Compose**: `app` só inicia após o `db` estar *healthy* (`depends_on: service_healthy`); dados persistem no volume `pgdata`; rede interna; o banco **não** expõe porta ao host.
- **Dockerfile**: imagem slim, camada de dependências em cache, usuário não-root, `HEALTHCHECK`, Gunicorn em vez do servidor de desenvolvimento.
- **Segredos** via `.env` (não versionado); o compose falha se `POSTGRES_PASSWORD` não for definida.

## Roteiro do vídeo (2–5 min)
1. (0:00) Objetivo e arquitetura: app Flask + Postgres em containers.
2. (0:40) Dockerfile: base slim, cache de dependências, non-root, healthcheck, gunicorn.
3. (1:20) docker-compose.yml: healthcheck do db, depends_on, volume, rede, variáveis.
4. (2:00) `docker compose up -d --build`, `ps` e `logs` (mostrar ausência de erros).
5. (3:00) Testes unitários e de integração rodando.
6. (3:40) Chamadas `curl` ao fluxo de um pedido e preenchimento da RDM.
