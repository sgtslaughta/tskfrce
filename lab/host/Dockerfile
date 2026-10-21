FROM alpine:3.20
RUN apk add --no-cache curl bind-tools iproute2 jq
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
