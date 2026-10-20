FROM python:3.12-alpine
RUN apk add --no-cache bash openssl
ENV PYTHONDONTWRITEBYTECODE=1
WORKDIR /deploy
ENTRYPOINT ["python", "/deploy/installer/configure.py"]
