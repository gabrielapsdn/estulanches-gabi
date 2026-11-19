"""Regras de negócio puras (sem banco/HTTP) -> testáveis por testes unitários."""
from decimal import Decimal, ROUND_HALF_UP

STATUS_FLUXO = {
    "RECEBIDO": ["EM_PREPARO", "CANCELADO"],
    "EM_PREPARO": ["PRONTO", "CANCELADO"],
    "PRONTO": ["ENTREGUE"],
    "ENTREGUE": [],
    "CANCELADO": [],
}


class ErroValidacao(ValueError):
    pass


def validar_item_cardapio(dados: dict) -> dict:
    nome = str(dados.get("nome", "")).strip()
    if len(nome) < 2:
        raise ErroValidacao("nome deve ter ao menos 2 caracteres")
    try:
        preco = Decimal(str(dados.get("preco")))
    except Exception:
        raise ErroValidacao("preco inválido")
    if preco <= 0:
        raise ErroValidacao("preco deve ser maior que zero")
    return {"nome": nome, "preco": preco.quantize(Decimal("0.01"), ROUND_HALF_UP)}


def calcular_total(itens: list) -> Decimal:
    """itens: [{'preco': Decimal|str|float, 'quantidade': int}]"""
    if not itens:
        raise ErroValidacao("pedido sem itens")
    total = Decimal("0")
    for i in itens:
        qtd = int(i["quantidade"])
        if qtd <= 0:
            raise ErroValidacao("quantidade deve ser maior que zero")
        total += Decimal(str(i["preco"])) * qtd
    return total.quantize(Decimal("0.01"), ROUND_HALF_UP)


def transicao_valida(atual: str, novo: str) -> bool:
    return novo in STATUS_FLUXO.get(atual, [])
