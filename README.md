# EstuLanches — Gestão de Cardápio e Pedidos da Cantina Escolar

**Aluna / Técnica de Implantação:** Gabriela do Nascimento  
**Turma:** 3B  
**Atividade:** Situação de Aprendizagem (SA) — Implantação em Produção com Docker  

**Stack:** Node.js (JavaScript) + Express · PostgreSQL 16 · Docker & Docker Compose.

---

## 🚀 Subir em Produção

```bash
# 1. Copiar variáveis de ambiente (se ainda não existir o .env)
cp .env.example .env

# 2. Subir os containers em segundo plano compilando a imagem
docker compose up -d --build

# 3. Verificar estado dos serviços e portas ativas (devem estar "healthy")
docker compose ps

# 4. Auditar logs de inicialização (garantir ausência de erros críticos)
docker compose logs db app

# 5. Testar saúde da aplicação e conexão com banco
curl http://localhost:8000/health
```

---

## 🧪 Testes Automatizados

```bash
# Todos os testes (unitários + integração locais)
npm test

# Apenas testes unitários (regras de negócio puras)
npm run test:unit

# Apenas testes de integração locais
npm run test:integration

# Testes de integração no container contra o PostgreSQL real
docker compose --profile test run --rm tests
```

---

## 📡 Endpoints da API REST

| Método | Rota | Função | Retorno |
|---|---|---|---|
| **GET** | `/health` | Valida saúde da API e conectividade com o banco | `200 OK` |
| **GET** | `/cardapio` | Lista itens disponíveis no cardápio | `200 OK` |
| **POST** | `/cardapio` | Cadastra novo item no cardápio | `201 Created` |
| **POST** | `/pedidos` | Cria pedido, valida itens e calcula o total | `201 Created` |
| **GET** | `/pedidos/:id` | Consulta pedido por identificador | `200 OK` / `404 Not Found` |
| **PATCH** | `/pedidos/:id/status` | Atualiza status (`RECEBIDO` → `EM_PREPARO` → `PRONTO` → `ENTREGUE` ou `CANCELADO`) | `200 OK` / `409 Conflict` |

### Exemplos com curl:
```bash
# Cadastrar item no cardápio
curl -X POST http://localhost:8000/cardapio -H "Content-Type: application/json" -d '{"nome":"Misto Quente","preco":8.50}'

# Fazer pedido
curl -X POST http://localhost:8000/pedidos -H "Content-Type: application/json" -d '{"aluno":"Gabriela","itens":[{"item_id":1,"quantidade":2}]}'
```

---

## 🏛️ Decisões de Arquitetura e Tecnologias

1. **Separação de Camadas (Clean Code / Single Responsibility)**:
   - `src/services.js`: Regras de negócio puras (cálculo financeiro, validações de preço/nome, máquina de estados de pedidos). Não dependem de HTTP nem de banco, permitindo testes unitários ultrarrápidos com o test runner nativo do Node.js (`node:test`).
   - `src/db.js`: Camada de persistência com pool de conexões do PostgreSQL (`pg`) e auto-migração de schema com espera ativa (`waitAndInit`).
   - `src/app.js`: Definição da API REST em Express, middleware centralizado de erros e inicialização desacoplada para facilitar testes de integração.
2. **Containerização Segura e Eficiente (Dockerfile)**:
   - Base `node:20-alpine` (imagem oficial leve e com superfície mínima de ataque).
   - Cache de camadas no build (`COPY package*.json ./` antes do código).
   - Execução como usuário não-root nativo (`USER node`), atendendo às diretrizes de segurança em produção.
   - `HEALTHCHECK` nativo via chamada HTTP interna ao `/health`.
3. **Orquestração com Docker Compose**:
   - `depends_on: db: condition: service_healthy`: impede *race conditions*, garantindo que a aplicação só suba quando o PostgreSQL aceitar conexões.
   - Persistência garantida via volume nomeado `pgdata`.
   - Segurança de rede: apenas a porta `8000` da aplicação é exposta no host; o PostgreSQL roda na porta interna `5432` acessível exclusivamente pela rede `interna`.
   - Segredos protegidos: variáveis sensíveis via `.env` (ignorado no versionamento Git).

---


