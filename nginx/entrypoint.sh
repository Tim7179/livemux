#!/bin/bash
# entrypoint.sh – nginx container startup
#
# Generates a self-signed TLS certificate if none is found at
# /etc/nginx/ssl/cert.pem and /etc/nginx/ssl/key.pem.
#
# For trusted certs (own CA or Let's Encrypt), mount them into the container:
#   volumes:
#     - /path/to/cert.pem:/etc/nginx/ssl/cert.pem:ro
#     - /path/to/key.pem:/etc/nginx/ssl/key.pem:ro

set -e

SSL_DIR="/etc/nginx/ssl"
CERT="$SSL_DIR/cert.pem"
KEY="$SSL_DIR/key.pem"

mkdir -p "$SSL_DIR"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  # Detect the container's primary IP for the SAN, fallback to 127.0.0.1
  SERVER_IP="${SERVER_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
  SERVER_IP="${SERVER_IP:-127.0.0.1}"

  echo "[SSL] Generating self-signed certificate for IP: ${SERVER_IP}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$KEY" -out "$CERT" \
    -subj "/CN=livemux" \
    -addext "subjectAltName=IP:${SERVER_IP},IP:127.0.0.1,DNS:localhost"
  echo "[SSL] Certificate written to ${CERT}"
  echo "[SSL] Import this file into your browser/OS trust store for a trusted connection."
fi

# Fix volume mount permissions (Docker named volumes are root:root by default)
chown -R www-data:www-data /hls /recordings

exec nginx -g "daemon off;"
