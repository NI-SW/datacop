#!/bin/bash
# Start DataCop MCP Server (HTTP mode)
cd "$(dirname "$0")"
source .venv/bin/activate
exec python server.py
