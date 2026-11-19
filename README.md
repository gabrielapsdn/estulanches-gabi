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

## 🎬 Roteiro Completo para Gravação do Vídeo (Tempo Total: ~3m45s)

> **Faixa permitida pelo professor:** Mínimo de 2 minutos e máximo de 5 minutos.  
> **Dica:** Grave a tela com seu microfone ligado usando OBS Studio ou o atalho do Windows `Win + Alt + R`.

---

### 🕒 1. (0:00 - 0:35) Apresentação da Autora e do Projeto
* **O que mostrar na tela:** O arquivo `README.md` ou a tela inicial da aplicação no navegador.
* **O que falar:**
  > *"Olá, professor e avaliadores! Meu nome é Gabriela do Nascimento, sou aluna da Turma 3B e atuei como Técnica de Implantação nesta atividade prática.*  
  > *O projeto desenvolvido é o **EstuLanches**, um sistema para gestão de cardápio e pedidos de cantinas escolares.*  
  > *Ele resolve o problema clássico de filas desorganizadas, erros de cobrança e falta de controle de estoque durante o intervalo escolar, permitindo aos alunos consultar o cardápio e fazer pedidos de forma rápida e segura."*

---

### 🕒 2. (0:35 - 1:10) Demonstração do Código e Arquitetura
* **O que mostrar na tela:** O VS Code aberto mostrando a pasta `src/` (`app.js`, `services.js`, `db.js`).
* **O que falar:**
  > *"O sistema foi construído em **Node.js (JavaScript)** utilizando boas práticas de arquitetura em camadas e desacoplamento:*  
  > *- Em `services.js`, temos regras de negócio puras — cálculo financeiro com precisão de centavos, validações de preço e a máquina de estados do pedido — sem dependência de banco ou HTTP, facilitando testes unitários rápidos.*  
  > *- Em `db.js`, gerenciamos a persistência com **PostgreSQL 16**, com pool de conexões e auto-migração de schema com espera ativa.*  
  > *- Em `app.js`, estruturamos a API REST com **Express**, implementando endpoints padronizados de cardápio, pedidos e o `/health`."*

---

### 🕒 3. (1:10 - 1:50) Dockerfile, Docker Compose e Segurança
* **O que mostrar na tela:** Os arquivos `Dockerfile` e `docker-compose.yml`.
* **O que falar:**
  > *"Para a implantação em produção, utilizamos Docker seguindo diretrizes rígidas de segurança:*  
  > *- No **Dockerfile**, usamos a imagem base leve `node:20-alpine`, separamos a instalação de dependências para aproveitar o cache de build, definimos um `HEALTHCHECK` nativo e rodamos o container com usuário sem privilégios (`USER node`), nunca como root.*  
  > *- No **docker-compose.yml**, o banco PostgreSQL e a aplicação se comunicam em uma rede interna isolada. A porta do banco (5432) não é exposta para o host, protegendo os dados. Temos persistência no volume `pgdata`, senhas seguras gerenciadas via `.env`, e a aplicação só sobe após o banco estar saudável através da diretiva `depends_on: condition: service_healthy`."*

---

### 🕒 4. (1:50 - 2:30) Execução dos Testes Automatizados
* **O que mostrar na tela:** O terminal executando os testes.
* **O que executar no terminal:**
  ```bash
  npm test
  ```
* **O que falar:**
  > *"A qualidade do software foi validada com testes automatizados:*  
  > *- Temos **7 testes unitários** testando regras de negócio puras (cálculos, validações e fluxos).*  
  > *- Temos **5 testes de integração** validando rotas HTTP, persistência e códigos de retorno como 200, 201, 400, 404 e 409.*  
  > *Como podemos ver no terminal, todos os 12 testes foram executados com 100% de aprovação."*

---

### 🕒 5. (2:30 - 3:05) Demonstração do Sistema na Prática
* **O que mostrar na tela:** O navegador em `http://localhost:8000` (ou `http://127.0.0.1:5500`).
* **O que fazer na tela:**
  - Mostrar o cardápio com as comidinhas (Coxinha de Frango, Misto Quente, Suco, Pão de Queijo).
  - Selecionar 2 coxinhas e 1 suco, clicar em **Confirmar e Fazer Pedido**.
  - No painel da cantina abaixo, mostrar o pedido criado e clicar no botão para avançar o status (`RECEBIDO` ➔ `EM PREPARO` ➔ `PRONTO` ➔ `ENTREGUE`).
* **O que falar:**
  > *"Aqui temos o sistema operando em tempo real. O cardápio exibe as comidinhas da cantina. Selecionamos os itens, o valor total é calculado automaticamente na tela, e enviamos o pedido.*  
  > *No painel da cantina, a cozinha acompanha o pedido e avança as etapas até a entrega ao aluno."*

---

### 🕒 6. (3:05 - 3:30) Exibição da Ficha RDM Preenchida
* **O que mostrar na tela:** Abrir o arquivo `RDM_EstuLanches.pdf` em leitor de PDF ou navegador.
* **O que falar:**
  > *"Como parte do processo de governança de TI, preenchi a **Ficha Simplificada de Registro de Mudança (RDM)** de 1 página.*  
  > *Ela documenta a versão 1.0.0 implantada, data e horário, parâmetros alterados de rede e variáveis, aprovação de 100% dos testes e o status final como Concluída com Sucesso, devidamente assinada."*

---

### 🕒 7. (3:30 - 4:10) Escalabilidade Nacional (1 Milhão de Usuários / 100 Mil Simultâneos)
* **O que mostrar na tela:** O slide, diagrama ou tópico de escalabilidade no README.
* **O que falar:**
  > *"Por fim, como técnico de implantação, planejei a arquitetura conceitual para escalar o EstuLanches para o Brasil inteiro — suportando **1 milhão de usuários cadastrados e 100 mil acessos simultâneos no horário de pico do recreio**:*  
  > *1. **Computação Elástica:** Migrar os containers para um cluster **Kubernetes** com Horizontal Pod Autoscaler (HPA), escalando os pods de Node.js dinamicamente conforme a demanda.*  
  > *2. **Balanço de Carga e CDN:** Uso de **Cloudflare / AWS CloudFront** na borda para entrega de assets estáticos e **Application Load Balancer** distribuindo o tráfego.*  
  > *3. **Cache em Memória:** Implementação de **Redis Cluster** para cachear o cardápio e sessões, reduzindo em até 80% as consultas ao banco.*  
  > *4. **Banco de Dados Distribuído:** PostgreSQL em nuvem gerenciada (como AWS Aurora) com instância primária para escrita, réplicas de leitura e PgBouncer para connection pooling.*  
  > *5. **Mensageria Assíncrona:** Fila com **RabbitMQ ou Kafka** para enfileirar os pedidos de compra, garantindo que nenhum pedido se perca mesmo sob picos extremos de acessos.*  
  > *Muito obrigada pela atenção!"*
