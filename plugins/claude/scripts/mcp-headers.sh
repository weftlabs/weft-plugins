#!/bin/sh
set -eu

credential_file=${1:?credential file path required}

if [ ! -s "$credential_file" ]; then
  printf '{}\n'
  exit 0
fi

IFS= read -r credential < "$credential_file"
case "$credential" in
  wbt_?*) ;;
  *)
    printf '%s\n' "Invalid Weft temporary credential file" >&2
    exit 1
    ;;
esac

case "$credential" in
  *[!A-Za-z0-9_-]*)
    printf '%s\n' "Invalid Weft temporary credential file" >&2
    exit 1
    ;;
esac

printf '{"Authorization":"Bearer %s"}\n' "$credential"
