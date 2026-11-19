import os, sys, unittest
from decimal import Decimal
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from services import (ErroValidacao, calcular_total, transicao_valida,
                      validar_item_cardapio)


class TestServicos(unittest.TestCase):
    def test_total_soma_itens(self):
        self.assertEqual(calcular_total([{"preco": "5.50", "quantidade": 2},
                                         {"preco": "3.00", "quantidade": 1}]), Decimal("14.00"))

    def test_pedido_vazio_rejeitado(self):
        with self.assertRaises(ErroValidacao):
            calcular_total([])

    def test_quantidade_invalida_rejeitada(self):
        with self.assertRaises(ErroValidacao):
            calcular_total([{"preco": "5", "quantidade": 0}])

    def test_item_valido_normaliza_preco(self):
        d = validar_item_cardapio({"nome": " Coxinha ", "preco": "6.5"})
        self.assertEqual(d, {"nome": "Coxinha", "preco": Decimal("6.50")})

    def test_item_preco_negativo(self):
        with self.assertRaises(ErroValidacao):
            validar_item_cardapio({"nome": "Suco", "preco": -1})

    def test_item_nome_curto(self):
        with self.assertRaises(ErroValidacao):
            validar_item_cardapio({"nome": "a", "preco": 3})

    def test_fluxo_de_status(self):
        self.assertTrue(transicao_valida("RECEBIDO", "EM_PREPARO"))
        self.assertFalse(transicao_valida("RECEBIDO", "ENTREGUE"))
        self.assertFalse(transicao_valida("ENTREGUE", "CANCELADO"))


if __name__ == "__main__":
    unittest.main()
