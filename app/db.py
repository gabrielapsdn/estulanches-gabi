"""Acesso a dados. PostgreSQL em produção; SQLite em testes (mesma API DB-API)."""
import os
import sqlite3
import time

SCHEMA_PG = """
CREATE TABLE IF NOT EXISTS cardapio (
  id SERIAL PRIMARY KEY, nome VARCHAR(80) NOT NULL, preco NUMERIC(8,2) NOT NULL,
  disponivel BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY, aluno VARCHAR(80) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'RECEBIDO',
  total NUMERIC(8,2) NOT NULL, criado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS pedido_itens (
  id SERIAL PRIMARY KEY, pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  item_id INT NOT NULL REFERENCES cardapio(id), quantidade INT NOT NULL CHECK (quantidade > 0));
"""

SCHEMA_SQLITE = """
CREATE TABLE IF NOT EXISTS cardapio (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, preco NUMERIC NOT NULL,
  disponivel INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT, aluno TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'RECEBIDO',
  total NUMERIC NOT NULL, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pedido_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT, pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  item_id INTEGER NOT NULL REFERENCES cardapio(id), quantidade INTEGER NOT NULL CHECK (quantidade > 0));
"""


class Database:
    def __init__(self, url: str):
        self.url = url
        self.postgres = url.startswith("postgres")
        self._mem = None  # conexão única p/ sqlite :memory:

    def connect(self):
        if self.postgres:
            import psycopg2
            return psycopg2.connect(self.url)
        path = self.url.replace("sqlite:///", "")
        if path == ":memory:":
            if self._mem is None:
                self._mem = sqlite3.connect(":memory:", check_same_thread=False)
            return self._mem
        return sqlite3.connect(path)

    def sql(self, query: str) -> str:
        return query.replace("?", "%s") if self.postgres else query

    def wait_and_init(self, tentativas: int = 30, espera: float = 2.0):
        for n in range(1, tentativas + 1):
            try:
                conn = self.connect()
                if self.postgres:
                    cur = conn.cursor()
                    cur.execute(SCHEMA_PG)
                else:
                    conn.executescript(SCHEMA_SQLITE)
                conn.commit()
                print("[db] conexão estabelecida e schema aplicado", flush=True)
                return
            except Exception as exc:  # banco ainda subindo
                print(f"[db] tentativa {n}/{tentativas} falhou: {exc}", flush=True)
                time.sleep(espera)
        raise RuntimeError("banco de dados indisponível")


def database_url() -> str:
    return os.environ.get("DATABASE_URL", "sqlite:///:memory:")
