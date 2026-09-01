#!/bin/bash

dir=$(readlink -f $(dirname $0))
rm -rf $dir/build/datacop
mkdir -p $dir/build/datacop

cd $dir/mcp/python

docker build -t libm/datacop:mcp . -f Dockerfile
mcp=$(docker images | grep datacop | grep mcp | awk '{print $3}')

cd $dir
docker build -t libm/datacop:server . -f Dockerfile
server=$(docker images | grep datacop | grep server | awk '{print $3}')

cd $dir/build/datacop
docker save -o datacop_mcp.tar $mcp 
docker save -o datacop_server.tar $server 
cp $dir/docker-compose.yml $dir/build/datacop/docker-compose.yml

cd $dir/build
tar -czvf datacop.tar.gz datacop


