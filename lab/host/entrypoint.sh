#!/bin/sh
ip route replace default via 10.99.0.2
ip -6 route replace default via fd00:99::2 || true
exec sleep infinity
