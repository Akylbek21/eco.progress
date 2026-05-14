#!/bin/sh
BACKEND_URL=${BACKEND_URL:-http://localhost:8080}
export BACKEND_URL
envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
