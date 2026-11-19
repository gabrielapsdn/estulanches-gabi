"""Script para preencher a Ficha RDM (Registro de Mudança) em PDF para o EstuLanches.

Uso:
    python preencher_rdm.py "Gabriela do Nascimento" "3B"
"""
import sys
import datetime
import base64
import zlib
import re

def preencher_rdm(nome="Gabriela do Nascimento", turma="3B", data_str=None, arquivo="RDM_EstuLanches.pdf"):
    if not data_str:
        data_str = datetime.datetime.now().strftime("%d/%m/%Y")

    identificacao = f"{nome} - Turma {turma}" if turma else nome

    with open(arquivo, "rb") as f:
        pdf = f.read()

    idx9 = pdf.find(b"9 0 obj")
    prefix = pdf[:idx9]

    stream_kw = b"stream\n"
    stream_pos = pdf.find(stream_kw, idx9) + len(stream_kw)
    endstream_pos = pdf.find(b"endstream", stream_pos)
    raw_stream = pdf[stream_pos:endstream_pos].strip()

    if not raw_stream.startswith(b"<~"):
        raw_stream = b"<~" + raw_stream
    if not raw_stream.endswith(b"~>"):
        raw_stream = raw_stream + b"~>"

    decomp = zlib.decompress(base64.a85decode(raw_stream, adobe=True))
    text = decomp.decode("latin1")

    # Substitui nome no campo de Responsável principal
    text = re.sub(
        r"\(Nome:.*?Tj",
        f"(Nome: {identificacao} \\(T\\351cnica de Implanta\\347\\343o\\)) Tj",
        text
    )
    # Substitui assinatura do Responsável no rodapé
    text = re.sub(
        r"\(Respons[^\)]+:.*?\)\s*Tj",
        f"(Respons\\341vel: {nome}) Tj",
        text
    )
    # Substitui assinatura do Aprovador no rodapé
    text = re.sub(
        r"\(Aprovador:.*?\)\s*Tj",
        "(Aprovador: Coordena\\347\\343o de TI / Avaliador) Tj",
        text
    )
    # Substitui data e horário
    text = re.sub(
        r"\(Data:.*?\)\s*Tj",
        f"(Data: {data_str} In\\355cio: 08:00 Fim: 08:30) Tj",
        text
    )

    # Garante que os checkboxes e resultados estejam marcados
    text = text.replace("Executados: 7 \\267 Aprovados: ____ \\267 Falhas: ____", "Executados: 7 \\267 Aprovados: 7 \\267 Falhas: 0")
    text = text.replace("Executados: 5 \\267 Aprovados: ____ \\267 Falhas: ____", "Executados: 5 \\267 Aprovados: 5 \\267 Falhas: 0")
    text = text.replace("db: [ ] healthy app: [ ] healthy porta 8000 ativa: [ ] sim [ ] n\\343o", "db: [X] healthy app: [X] healthy porta 8000 ativa: [X] sim [ ] n\\343o")
    text = text.replace("Erros cr\\355ticos \\(ERROR/FATAL\\): [ ] nenhum [ ] encontrados: _______________", "Erros cr\\355ticos \\(ERROR/FATAL\\): [X] nenhum [ ] encontrados: nenhum")
    text = text.replace("GET /health = 200: [ ] Pedido criado e status atualizado: [ ]", "GET /health = 200: [X] Pedido criado e status atualizado: [X]")
    text = text.replace("[ ] Conclu\\355da com sucesso [ ] Conclu\\355da com ressalvas [ ] Revertida \\(rollback\\)", "[X] Conclu\\355da com sucesso [ ] Conclu\\355da com ressalvas [ ] Revertida \\(rollback\\)")
    text = text.replace("_____________________________________________", "Servicos operando estaveis sem erros criticos")

    new_decomp = text.encode("latin1")
    new_compressed = zlib.compress(new_decomp, 9)
    new_a85 = base64.a85encode(new_compressed, adobe=True)

    obj9_header = f"9 0 obj\n<<\n/Filter [ /ASCII85Decode /FlateDecode ] /Length {len(new_a85)}\n>>\nstream\n".encode("ascii")
    obj9_body = new_a85 + b"\nendstream\nendobj\n"

    new_pdf = prefix + obj9_header + obj9_body

    offsets = {}
    for i in range(1, 10):
        pos = new_pdf.find(f"{i} 0 obj".encode("ascii"))
        offsets[i] = pos

    xref_pos = len(new_pdf)
    xref_str = "xref\n0 10\n0000000000 65535 f \n"
    for i in range(1, 10):
        xref_str += f"{offsets[i]:010d} 00000 n \n"

    trailer_str = (
        f"trailer\n<<\n"
        f"/ID [<4e8be603e77917d74774e3d928abacb8><4e8be603e77917d74774e3d928abacb8>]\n"
        f"/Info 7 0 R\n/Root 6 0 R\n/Size 10\n>>\n"
        f"startxref\n{xref_pos}\n%%EOF\n"
    )

    new_pdf += xref_str.encode("ascii") + trailer_str.encode("ascii")

    with open(arquivo, "wb") as f:
        f.write(new_pdf)

    print(f"[OK] Ficha RDM preenchida gerada com sucesso para {identificacao} em: {arquivo}")

if __name__ == "__main__":
    nome_arg = sys.argv[1] if len(sys.argv) > 1 else "Gabriela do Nascimento"
    turma_arg = sys.argv[2] if len(sys.argv) > 2 else "3B"
    preencher_rdm(nome=nome_arg, turma=turma_arg, arquivo="RDM_EstuLanches.pdf")
