#!/bin/bash
echo "Starting server..."
docker compose up --build db --build redis --build db-init --build api