#!/bin/bash
# DataCop MCP Server launcher - ignores SIGHUP
trap '' HUP
cd /home/github/datacop/mcp/python
exec .venv/bin/python server.py
