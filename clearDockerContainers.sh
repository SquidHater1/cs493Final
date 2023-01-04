#!/bin/bash
echo "removing docker containers..."
docker container stop $(docker container ls -aq)
docker system prune -f