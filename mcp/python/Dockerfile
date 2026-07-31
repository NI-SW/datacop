FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml ./
RUN uv pip install --system --no-cache .
COPY server.py ./
EXPOSE 8301
CMD ["python", "server.py"]
