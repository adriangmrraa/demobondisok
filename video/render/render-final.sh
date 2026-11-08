#!/usr/bin/env bash
# Full, unattended render of the Demobondis explainer.
# Writes video/out/render.log and, at the end, video/out/RENDER-DONE.json
# (or video/out/RENDER-FAILED.txt). Designed to be launched detached:
#   powershell -NoProfile -Command "Start-Process -WindowStyle Hidden bash -ArgumentList '-lc','bash video/render/render-final.sh'"
set -u
cd "$(dirname "$0")/../.." || exit 1
mkdir -p video/out video/entrega
rm -f video/out/RENDER-DONE.json video/out/RENDER-FAILED.txt
export WORKERS="${WORKERS:-4}"
export FPS="${FPS:-30}"
export CRF="${CRF:-20}"
export FINAL="${FINAL:-$PWD/video/entrega/demobondis-explicativo-vertical.mp4}"
{
  echo "=== render start $(date -Is) workers=$WORKERS fps=$FPS crf=$CRF ==="
  node video/render/render.mjs
  echo "=== render exit=$? $(date -Is) ==="
} >> video/out/render.log 2>&1
