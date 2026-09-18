#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

data_dir="$tmp/data"
mkdir -p "$data_dir"

empty_headers=$("$root/scripts/mcp-headers.sh" "$data_dir/temporary_api_key")
[ "$empty_headers" = '{}' ]

printf '%s\n' 'wbt_bad"credential' > "$data_dir/temporary_api_key"
if "$root/scripts/mcp-headers.sh" "$data_dir/temporary_api_key" >/dev/null 2>&1; then
  printf '%s\n' "invalid credential was accepted" >&2
  exit 1
fi
rm "$data_dir/temporary_api_key"

fake_bin="$tmp/bin"
mkdir -p "$fake_bin"
cat > "$fake_bin/curl" <<'EOF'
#!/bin/sh
output=
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    output=$2
    shift 2
  else
    shift
  fi
done
printf '%s' '{"data":{"id":"boot_test","status":"pending","expires_at":"2026-08-26T00:00:00Z","approval":{"user_code":"ABCD-1234"},"temporary_api_key":"wbt_test-secret"}}' > "$output"
printf '201'
EOF
chmod +x "$fake_bin/curl"

result=$(PATH="$fake_bin:$PATH" "$root/scripts/bootstrap.sh" user@example.com "$data_dir")
printf '%s' "$result" | grep -q 'Bootstrap: boot_test'
printf '%s' "$result" | grep -q 'Approval code: ABCD-1234'
if printf '%s' "$result" | grep -q 'wbt_test-secret'; then
  printf '%s\n' "bootstrap output exposed the credential" >&2
  exit 1
fi

[ "$(cat "$data_dir/temporary_api_key")" = 'wbt_test-secret' ]
[ "$(stat -c '%a' "$data_dir/temporary_api_key" 2>/dev/null || stat -f '%Lp' "$data_dir/temporary_api_key")" = '600' ]
[ "$("$root/scripts/mcp-headers.sh" "$data_dir/temporary_api_key")" = '{"Authorization":"Bearer wbt_test-secret"}' ]

"$root/scripts/bootstrap.sh" --clear "$data_dir" >/dev/null
[ ! -e "$data_dir/temporary_api_key" ]

if "$root/scripts/bootstrap.sh" 'bad"email@example.com' "$data_dir" >/dev/null 2>&1; then
  printf '%s\n' "invalid email was accepted" >&2
  exit 1
fi

assert_onboarding_copy() {
  copy=$(tr '\n' ' ' < "$1")
  printf '%s' "$copy" | grep -qi 'open the claim email, verify the address'
  printf '%s' "$copy" | grep -q 'one-time signup grant'
  printf '%s' "$copy" | grep -q 'call `weft_balance`; the balance is the truth'
  printf '%s' "$copy" | grep -qi 'do not ask the human to top up the wallet'
}

assert_onboarding_copy "$root/README.md"
assert_onboarding_copy "$root/commands/setup.md"
if grep -Eiq 'no promotional balance|must fund|fund (it|the|your) wallet|top up (the|your) wallet before' \
  "$root/README.md" "$root/commands/setup.md"; then
  printf '%s\n' "plugin onboarding copy asks for funding instead of email verification" >&2
  exit 1
fi

printf '%s\n' "plugin tests passed"
