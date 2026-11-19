# ---------- EstuLanches: imagem da aplicação ----------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

# Camada de dependências separada (aproveita cache do build)
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY tests ./tests

# Segurança: não executar como root
RUN useradd --system --no-create-home estu && chown -R estu /srv
USER estu

WORKDIR /srv/app
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--access-logfile", "-", "app:app_factory()"]
