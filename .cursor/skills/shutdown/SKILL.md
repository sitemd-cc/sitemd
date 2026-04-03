---
name: shutdown
description: Kill the sitemd dev server. Companion to /launch.
user-invocable: true
disable-model-invocation: true
---

> **User-invoked only.** Never call this skill automatically or as part of another workflow. Only run when the user explicitly types `/shutdown`.

# Shutdown

## Procedure

Run the following script. It uses three complementary strategies to ensure nothing survives:

```bash
#!/bin/bash
KILLED=""

# --- Strategy 1: Kill by port ---
PORTS=$(find . -path '*/settings/build.md' \
  -not -path '*/node_modules/*' \
  -not -path '*/distro/out/*' \
  -not -path '*/source/sitemd/templates/*' \
  -exec grep -h '^port:' {} \; 2>/dev/null \
  | awk '{print $2}' | sort -u)
# Always include default ports even if found in settings
PORTS=$(echo -e "${PORTS}\n4747\n4848" | sort -u | grep -v '^$')
for PORT in $PORTS; do
  PIDS=$(lsof -ti:$PORT 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null
    KILLED="${KILLED}port:${PORT} "
  fi
done

# --- Strategy 2: Kill node processes running engine/build --serve ---
PIDS=$(pgrep -f 'node.*engine/build.*--serve' 2>/dev/null)
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs kill -9 2>/dev/null
  KILLED="${KILLED}node-engine-build "
fi

# --- Strategy 3: Kill sitemd binary processes (launch/serve) ---
PIDS=$(pgrep -f 'sitemd.*(launch|--serve|serve)' 2>/dev/null)
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs kill -9 2>/dev/null
  KILLED="${KILLED}sitemd-binary "
fi

# --- Report ---
if [ -n "$KILLED" ]; then
  echo "Killed dev servers: $KILLED"
else
  echo "No dev servers found running."
fi
```

## Rules

- **Discover ports from all `settings/build.md` files** — but always include 4747 and 4848 as fallbacks
- All three strategies run every time — port-based, process-name, and binary-name
- Uses `kill -9` (SIGKILL) to ensure immediate termination with no graceful-shutdown hangs
- Only run when the user explicitly requests it
- Never call automatically or as part of another workflow
