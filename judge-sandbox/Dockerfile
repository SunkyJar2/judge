FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install --no-install-recommends --yes \
      coreutils \
      g++ \
      gcc \
      python3 \
    && rm -rf /var/lib/apt/lists/*

ENTRYPOINT []
