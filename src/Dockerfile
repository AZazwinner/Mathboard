FROM python:3.14-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt requirements-dev.txt ./
RUN pip install -r requirements.txt

COPY . .


FROM base AS test

RUN pip install -r requirements-dev.txt

CMD ["pytest", "-q"]


FROM base AS runtime

RUN rm -rf tests pytest.ini requirements-dev.txt \
    && useradd --system --uid 10001 --no-create-home app \
    && chown -R app:app /app

USER 10001

ENV PORT=12001
EXPOSE 12001

CMD ["python", "main.py"]
