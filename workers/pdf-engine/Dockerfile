# The PDF engine (ADR-0028): Docling and RapidOCR on CPU. Models are downloaded while the image is built (a warm-up
# conversion), so a running engine never reaches the internet. Build context: workers/pdf-engine.
FROM python:3.12.12-slim-bookworm
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 HF_HOME=/opt/models UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
# OpenCV (RapidOCR) needs libGL and GLib; tini stops the worker cleanly.
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 tini && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.11.31 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev
COPY tests/fixtures/chapter.pdf /tmp/warmup.pdf
RUN .venv/bin/python -m pdf_engine.warmup /tmp/warmup.pdf en && rm /tmp/warmup.pdf && chmod -R a+rX /opt/models /app/.venv
USER 65532:65532
ENTRYPOINT ["tini", "--", "/app/.venv/bin/python", "-m", "pdf_engine"]
