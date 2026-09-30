FROM php:8-apache

# 换成阿里云 Debian 镜像（添加在这一行之后）
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.aliyun.com/debian|g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's|http://deb.debian.org/debian-security|http://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources
    
# docker-php-extension-installer（脚本本地化，构建不再依赖 GitHub 网络）
COPY docker/install-php-extensions /usr/local/bin/install-php-extensions
RUN chmod 0755 /usr/local/bin/install-php-extensions

# Install extensions and cleanup in a single layer to reduce image size
RUN install-php-extensions iconv gd pdo pdo_mysql pdo_pgsql pgsql \
    && rm -f /usr/src/php.tar.xz /usr/src/php.tar.xz.asc \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Prepare files and folders
RUN mkdir -p /speedtest/

# Copy sources
COPY backend/ /speedtest/backend
COPY frontend/ /speedtest/frontend

COPY results/*.php /speedtest/results/
COPY results/*.ttf /speedtest/results/

COPY *.js /speedtest/
COPY index.html /speedtest/
COPY index-classic.html /speedtest/
COPY index-modern.html /speedtest/
COPY config.json /speedtest/
COPY favicon.ico /speedtest/

COPY docker/*.php /speedtest/
COPY site-config.php /speedtest/
# 镜像内置的通用站点配置模板（无任何学校定制内容；部署时用 docker/site/ 挂载覆盖）
COPY docker/default-site/ /speedtest/docker-site/
COPY docker/entrypoint.sh /

# Prepare default environment variables
ENV TITLE=LibreSpeed
ENV MODE=standalone
ENV PASSWORD=password
ENV TELEMETRY=false
ENV ENABLE_ID_OBFUSCATION=false
ENV REDACT_IP_ADDRESSES=false
ENV WEBPORT=8080
ENV USE_NEW_DESIGN=false
# Optional one-line notice under the speedtest UI (see entrypoint.sh FOOTER_NOTICE)
ENV FOOTER_NOTICE=
# Optional bilingual strings for classic UI (see entrypoint.sh): *_ZH / *_EN override *_NOTICE / TITLE per language
ENV TITLE_EN=
ENV TITLE_ZH=
ENV FOOTER_NOTICE_EN=
ENV FOOTER_NOTICE_ZH=
# 统计页开关：默认禁用 results/stats.php（测速记录查看页）；启用时登录密码为 PASSWORD
ENV ENABLE_STATS=false

# https://httpd.apache.org/docs/2.4/stopping.html#gracefulstop
STOPSIGNAL SIGWINCH

# Add labels for better metadata
LABEL org.opencontainers.image.title="LibreSpeed"
LABEL org.opencontainers.image.description="A Free and Open Source speed test that you can host on your server(s)"
LABEL org.opencontainers.image.vendor="LibreSpeed"
LABEL org.opencontainers.image.url="https://github.com/librespeed/speedtest"
LABEL org.opencontainers.image.source="https://github.com/librespeed/speedtest"
LABEL org.opencontainers.image.documentation="https://github.com/librespeed/speedtest/blob/master/doc_docker.md"
LABEL org.opencontainers.image.licenses="LGPL-3.0-or-later"

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${WEBPORT}/ || exit 1

# Final touches
EXPOSE ${WEBPORT}
CMD ["bash", "/entrypoint.sh"]
