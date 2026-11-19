"""Integração: rotas HTTP + camada de banco.
Por padrão usa SQLite em memória; no Docker use TEST_DATABASE_URL=postgresql://... (banco real)."""
import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from app import create_app


class TestFluxoPedido(unittest.TestCase):
    def setUp(self):
        self.client = create_app(os.environ.get("TEST_DATABASE_URL", "sqlite:///:memory:")).test_client()

    def test_health(self):
        r = self.client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["status"], "ok")

    def test_fluxo_completo(self):
        a = self.client.post("/cardapio", json={"nome": "Coxinha", "preco": 6.5}).get_json()
        b = self.client.post("/cardapio", json={"nome": "Suco", "preco": 4}).get_json()
        self.assertGreaterEqual(len(self.client.get("/cardapio").get_json()), 2)

        r = self.client.post("/pedidos", json={"aluno": "Ana", "itens": [
            {"item_id": a["id"], "quantidade": 2}, {"item_id": b["id"], "quantidade": 1}]})
        self.assertEqual(r.status_code, 201)
        pedido = r.get_json()
        self.assertEqual(pedido["total"], 17.0)

        pid = pedido["id"]
        for novo in ("EM_PREPARO", "PRONTO", "ENTREGUE"):
            self.assertEqual(self.client.patch(f"/pedidos/{pid}/status", json={"status": novo}).status_code, 200)
        self.assertEqual(self.client.get(f"/pedidos/{pid}").get_json()["status"], "ENTREGUE")

    def test_transicao_invalida_409(self):
        a = self.client.post("/cardapio", json={"nome": "Pão", "preco": 3}).get_json()
        pid = self.client.post("/pedidos", json={"aluno": "Beto", "itens": [
            {"item_id": a["id"], "quantidade": 1}]}).get_json()["id"]
        r = self.client.patch(f"/pedidos/{pid}/status", json={"status": "ENTREGUE"})
        self.assertEqual(r.status_code, 409)

    def test_pedido_item_inexistente_400(self):
        r = self.client.post("/pedidos", json={"aluno": "Caio", "itens": [{"item_id": 999, "quantidade": 1}]})
        self.assertEqual(r.status_code, 400)

    def test_pedido_inexistente_404(self):
        self.assertEqual(self.client.get("/pedidos/12345").status_code, 404)


if __name__ == "__main__":
    unittest.main()
