#!/bin/sh
# usage: pw.sh script.js
S=/tmp/claude-1000/-home-user-code-tskfrce/462f9507-82a5-47c0-8333-54e8d11390a5/scratchpad
docker run --rm --network host --ipc=host -v /home/user/code/tskfrce-redesign/frontend/node_modules:/w/node_modules:ro -v $S:/s -w /s mcr.microsoft.com/playwright:v1.64.1-jammy node /s/$1
