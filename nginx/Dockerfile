FROM debian:trixie-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    libnginx-mod-rtmp \
    ffmpeg \
    curl \
    bash \
    coreutils \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Create directories for HLS segments, recordings, and TLS certificates
RUN mkdir -p /hls /recordings /etc/nginx/ssl && \
    chown -R www-data:www-data /hls /recordings && \
    chmod 755 /hls /recordings

# Override default nginx config
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/stat.xsl   /usr/share/nginx/html/stat.xsl

# FLV → MP4 conversion script
COPY nginx/convert.sh /usr/local/bin/convert.sh
RUN chmod +x /usr/local/bin/convert.sh

# Startup script: generates self-signed TLS cert if none exists, then runs nginx
COPY nginx/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Web admin dashboard
COPY web/ /usr/share/nginx/html/

# Healthcheck: use plain HTTP /health (bypasses HTTPS redirect)
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

EXPOSE 1935 80 443

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
