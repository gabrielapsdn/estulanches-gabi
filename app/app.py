import os
from flask import Flask, jsonify, request

from db import Database, database_url
from services import (ErroValidacao, calcular_total, transicao_valida,
                      validar_item_cardapio)

VERSAO = os.environ.get("APP_VERSION", "1.0.0")


def create_app(db_url=None) -> Flask:
    app = Flask(__name__)
    db = Database(db_url or database_url())
    db.wait_and_init()
    app.config["DB"] = db
    true_val = True if db.postgres else 1

    def run(query, params=(), fetch=None, commit=False):
        conn = db.connect()
        cur = conn.cursor()
        cur.execute(db.sql(query), params)
        out = None
        if fetch == "all":
            out = cur.fetchall()
        elif fetch == "one":
            out = cur.fetchone()
        if commit:
            conn.commit()
        return out

    @app.errorhandler(ErroValidacao)
    def _validacao(e):
        return jsonify(erro=str(e)), 400

    @app.get("/health")
    def health():
        run("SELECT 1", fetch="one")
        return jsonify(status="ok", versao=VERSAO)

    @app.get("/cardapio")
    def listar_cardapio():
        rows = run("SELECT id, nome, preco FROM cardapio WHERE disponivel = ? ORDER BY id",
                   (true_val,), fetch="all")
        return jsonify([{"id": r[0], "nome": r[1], "preco": float(r[2])} for r in rows])

    @app.post("/cardapio")
    def criar_item():
        d = validar_item_cardapio(request.get_json(force=True, silent=True) or {})
        conn = db.connect()
        cur = conn.cursor()
        if db.postgres:
            cur.execute(db.sql("INSERT INTO cardapio (nome, preco) VALUES (?, ?) RETURNING id"),
                        (d["nome"], d["preco"]))
            novo = cur.fetchone()[0]
        else:
            cur.execute("INSERT INTO cardapio (nome, preco) VALUES (?, ?)", (d["nome"], str(d["preco"])))
            novo = cur.lastrowid
        conn.commit()
        return jsonify(id=novo, nome=d["nome"], preco=float(d["preco"])), 201

    @app.post("/pedidos")
    def criar_pedido():
        body = request.get_json(force=True, silent=True) or {}
        aluno = str(body.get("aluno", "")).strip()
        if not aluno:
            raise ErroValidacao("aluno é obrigatório")
        itens = []
        for it in body.get("itens", []):
            row = run("SELECT id, preco FROM cardapio WHERE id = ? AND disponivel = ?",
                      (it.get("item_id"), true_val), fetch="one")
            if not row:
                raise ErroValidacao(f"item {it.get('item_id')} inexistente")
            itens.append({"item_id": row[0], "preco": row[1], "quantidade": it.get("quantidade", 0)})
        total = calcular_total(itens)

        conn = db.connect()
        cur = conn.cursor()
        if db.postgres:
            cur.execute(db.sql("INSERT INTO pedidos (aluno, total) VALUES (?, ?) RETURNING id"), (aluno, total))
            pid = cur.fetchone()[0]
        else:
            cur.execute("INSERT INTO pedidos (aluno, total) VALUES (?, ?)", (aluno, str(total)))
            pid = cur.lastrowid
        for i in itens:
            cur.execute(db.sql("INSERT INTO pedido_itens (pedido_id, item_id, quantidade) VALUES (?, ?, ?)"),
                        (pid, i["item_id"], int(i["quantidade"])))
        conn.commit()
        return jsonify(id=pid, aluno=aluno, status="RECEBIDO", total=float(total)), 201

    @app.get("/pedidos/<int:pid>")
    def obter_pedido(pid):
        r = run("SELECT id, aluno, status, total FROM pedidos WHERE id = ?", (pid,), fetch="one")
        if not r:
            return jsonify(erro="pedido não encontrado"), 404
        return jsonify(id=r[0], aluno=r[1], status=r[2], total=float(r[3]))

    @app.patch("/pedidos/<int:pid>/status")
    def atualizar_status(pid):
        novo = (request.get_json(force=True, silent=True) or {}).get("status")
        r = run("SELECT status FROM pedidos WHERE id = ?", (pid,), fetch="one")
        if not r:
            return jsonify(erro="pedido não encontrado"), 404
        if not transicao_valida(r[0], novo):
            return jsonify(erro=f"transição {r[0]} -> {novo} não permitida"), 409
        run("UPDATE pedidos SET status = ? WHERE id = ?", (novo, pid), commit=True)
        return jsonify(id=pid, status=novo)

    return app


def app_factory():  # usado pelo gunicorn: "app:app_factory()"
    return create_app()
