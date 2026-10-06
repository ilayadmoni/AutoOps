# MinIO community edition is distributed as source; build a pinned release.
FROM golang:1.24-alpine AS build
ARG MINIO_RELEASE=RELEASE.2025-10-15T17-29-55Z
RUN apk add --no-cache git \
 && CGO_ENABLED=0 go install -trimpath -ldflags "-s -w" github.com/minio/minio@${MINIO_RELEASE}

FROM alpine:3.20
RUN apk add --no-cache ca-certificates curl \
 && adduser -D -u 10002 minio \
 && mkdir /data && chown minio /data
COPY --from=build /go/bin/minio /usr/local/bin/minio
USER minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
