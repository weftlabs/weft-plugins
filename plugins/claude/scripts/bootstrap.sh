#!/bin/sh
set -eu

usage() {
  printf '%s\n' "Usage: bootstrap.sh <email|--clear> <plugin-data-directory>" >&2
  exit 2
}

[ "$#" -eq 2 ] || usage

email=$1
data_dir=$2
credential_file="$data_dir/temporary_api_key"

umask 077
mkdir -p "$data_dir"
chmod 700 "$data_dir"

if [ "$email" = "--clear" ]; then
  rm -f "$credential_file"
  printf '%s\n' "Temporary Weft credential cleared. Restart Claude Code to use OAuth."
  exit 0
fi

case "$email" in
  *[!A-Za-z0-9._%+@-]*|*@*@*|@*|*@|*..*|.*|*.)
    printf '%s\n' "Enter one ordinary email address." >&2
    exit 2
    ;;
esac

endpoint=${WEFT_BOOTSTRAP_URL:-https://weft.network/api/v1/account_bootstraps}
response=$(mktemp "$data_dir/bootstrap-response.XXXXXX")
credential_tmp=$(mktemp "$data_dir/temporary-api-key.XXXXXX")
trap 'rm -f "$response" "$credential_tmp"' EXIT HUP INT TERM

payload=$(printf '{"email":"%s","agent_name":"Claude Code","host_name":"Weft Claude plugin","reason":"Connect Weft to Claude Code"}' "$email")
status=$(curl -sS --connect-timeout 10 --max-time 30 \
  -o "$response" -w '%{http_code}' -X POST "$endpoint" \
  -H 'Content-Type: application/json' \
  --data "$payload")

if [ "$status" != "201" ]; then
  printf 'Weft bootstrap failed (HTTP %s).\n' "$status" >&2
  exit 1
fi

extract_string() {
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$response" | head -n 1
}

credential=$(extract_string temporary_api_key)
bootstrap_id=$(extract_string id)
user_code=$(extract_string user_code)
expires_at=$(extract_string expires_at)

case "$credential" in
  wbt_?*) ;;
  *)
    printf '%s\n' "Weft returned no valid temporary credential." >&2
    exit 1
    ;;
esac

case "$credential" in
  *[!A-Za-z0-9_-]*)
    printf '%s\n' "Weft returned no valid temporary credential." >&2
    exit 1
    ;;
esac

printf '%s\n' "$credential" > "$credential_tmp"
chmod 600 "$credential_tmp"
mv -f "$credential_tmp" "$credential_file"

printf '%s\n' "Temporary Weft connection created."
printf 'Bootstrap: %s\n' "$bootstrap_id"
printf 'Approval code: %s\n' "$user_code"
printf 'Expires: %s\n' "$expires_at"
printf '%s\n' "Ask the user to claim the email, restart Claude Code, then call weft_connection_status."
