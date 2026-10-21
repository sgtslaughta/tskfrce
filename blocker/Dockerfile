FROM python:3.11-slim

# nftables: firewall rules. libpcap: packet capture/injection for scapy.
RUN apt-get update \
    && apt-get install -y --no-install-recommends nftables libpcap0.8 libpcap-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
COPY . /opt/blocker
RUN pip install --no-cache-dir "scapy>=2.6"

# Runs as root ON PURPOSE: ARP/NDP spoofing and nftables need NET_RAW and
# NET_ADMIN, which an unprivileged user cannot hold. Compose runs it with host
# networking and ONLY those two capabilities (not privileged).
CMD ["python3", "-m", "blocker"]
