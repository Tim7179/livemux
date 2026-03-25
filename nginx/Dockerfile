FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    nginx \
    libnginx-mod-rtmp \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create directories for HLS segments and recordings
RUN mkdir -p /hls /recordings && \
    chown -R www-data:www-data /hls /recordings && \
    chmod 755 /hls /recordings

# Override default nginx config
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/stat.xsl   /usr/share/nginx/html/stat.xsl

# Web admin dashboard
COPY web/ /usr/share/nginx/html/

# Healthcheck: verify nginx is serving HTTP
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

EXPOSE 1935 80

CMD ["nginx", "-g", "daemon off;"]
