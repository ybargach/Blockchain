#!/bin/sh
# Replace env variables in JS files
find /usr/share/nginx/html/js -type f -name '*.js' -exec sed -i "s|__HOST_IP__|$HOST_IP|g" {} +