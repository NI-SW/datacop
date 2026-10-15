#!/bin/bash
set -e

cd "$(dirname "$0")"

pull_image() {
    local image="$1"
    local service="$2"
    
    if docker image inspect "$image" &>/dev/null; then
        echo "[✓] 镜像 $image 已存在本地"
        return 0
    fi
    
    echo "[↓] 尝试拉取镜像 $image ..."
    if docker pull "$image" 2>/dev/null; then
        echo "[✓] 镜像 $image 拉取成功"
        return 0
    else
        echo "[!] 镜像 $image 拉取失败，将从源码构建"
        docker compose build "$service"
        return 0
    fi
}

echo "=== DataCop 启动 ==="
echo ""

pull_image "libm/datacop:server" "server"
pull_image "libm/datacop:mcp" "mcp"

echo ""
echo "=== 启动服务 ==="
docker compose up -d "$@"
