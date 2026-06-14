#!/usr/bin/env bash
# =============================================================================
# Unturn Platform — End-to-End Walkthrough Script
#
# Demonstrates the full flow: sign up → create workspace → seed UGC flow →
# set credentials → run the flow → poll Temporal for status.
#
# Prerequisites:
#   - docker compose up (postgres + temporal + api + worker-free)
#   - jq installed
#   - OPENAI_API_KEY set in environment or .env
#
# Usage:
#   ./scripts/walkthrough.sh
#   WEBSITE_URL=https://nike.com META_PAGE_ID=15087023444 ./scripts/walkthrough.sh
# =============================================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
WEBSITE_URL="${WEBSITE_URL:-https://www.nike.com/ie/}"
META_PAGE_ID="${META_PAGE_ID:-}"

EMAIL="${DEMO_EMAIL:-demo@unturn.io}"
PASSWORD="${DEMO_PASSWORD:-demo-password-123}"
WORKSPACE_NAME="${WORKSPACE_NAME:-Nike Demo}"
WORKSPACE_SLUG="${WORKSPACE_SLUG:-nike-demo}"

# ── Colours ──────────────────────────────────────────────────────────────────
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

step()  { echo -e "\n${BLUE}▶ $*${RESET}"; }
ok()    { echo -e "${GREEN}✓ $*${RESET}"; }
info()  { echo -e "${CYAN}  $*${RESET}"; }
warn()  { echo -e "${YELLOW}⚠ $*${RESET}"; }
die()   { echo -e "${RED}✗ $*${RESET}"; exit 1; }

require() { command -v "$1" &>/dev/null || die "Required tool not found: $1"; }

# ── Preflight ─────────────────────────────────────────────────────────────────
require curl
require jq

echo -e "${BLUE}"
cat <<'BANNER'
 _   _       _
| | | |_ __ | |_ _   _ _ __ _ __
| | | | '_ \| __| | | | '__| '_ \
| |_| | | | | |_| |_| | |  | | | |
 \___/|_| |_|\__|\__,_|_|  |_| |_|

End-to-End Walkthrough
BANNER
echo -e "${RESET}"

info "API base: $BASE_URL"
info "Website:  $WEBSITE_URL"
[[ -n "$META_PAGE_ID" ]] && info "Meta page: $META_PAGE_ID" || warn "META_PAGE_ID not set — meta-ads-search step will be skipped or use demo data"

# ── 1. Wait for API ───────────────────────────────────────────────────────────
step "1/8  Waiting for API to be ready..."
for i in $(seq 1 30); do
  if curl -sf "$BASE_URL/api/health" &>/dev/null || curl -sf "$BASE_URL/" &>/dev/null; then
    ok "API is up"
    break
  fi
  [[ $i -eq 30 ]] && die "API not reachable at $BASE_URL after 30s"
  sleep 1
done

# ── 2. Sign up / sign in ──────────────────────────────────────────────────────
step "2/8  Authenticating ($EMAIL)..."

SIGNUP_RESP=$(curl -sf -X POST "$BASE_URL/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Demo User\"}" 2>&1 || true)

SIGNIN_RESP=$(curl -sf -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" 2>&1)

TOKEN=$(echo "$SIGNIN_RESP" | jq -r '.token // empty')
[[ -z "$TOKEN" ]] && die "Sign-in failed: $SIGNIN_RESP"
ok "Signed in — token: ${TOKEN:0:12}..."

AUTH_HEADER="Authorization: Bearer $TOKEN"

# ── 3. Create workspace ───────────────────────────────────────────────────────
step "3/8  Creating workspace '$WORKSPACE_NAME' (slug: $WORKSPACE_SLUG)..."

# Create the org in better-auth
curl -sf -X POST "$BASE_URL/api/auth/organization/create" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "{\"name\":\"$WORKSPACE_NAME\",\"slug\":\"$WORKSPACE_SLUG\"}" &>/dev/null || warn "Workspace may already exist"

# Resolve to internal UUID via /tenants/mine
TENANTS=$(curl -sf "$BASE_URL/api/tenants/mine" -H "$AUTH_HEADER")
TENANT_ID=$(echo "$TENANTS" | jq -r --arg slug "$WORKSPACE_SLUG" '.[] | select(.slug == $slug) | .id // empty')

if [[ -z "$TENANT_ID" ]]; then
  # Fall back to first available tenant
  TENANT_ID=$(echo "$TENANTS" | jq -r '.[0].id // empty')
  TENANT_NAME=$(echo "$TENANTS" | jq -r '.[0].name // "unknown"')
  warn "Slug '$WORKSPACE_SLUG' not found, using first tenant: $TENANT_NAME ($TENANT_ID)"
fi

[[ -z "$TENANT_ID" ]] && die "No tenant found. Response: $TENANTS"
ok "Tenant UUID: $TENANT_ID"

# ── 4. Set credentials ────────────────────────────────────────────────────────
step "4/8  Setting tenant credentials..."

CREDS="{}"
[[ -n "${OPENAI_API_KEY:-}" ]] && CREDS=$(echo "$CREDS" | jq --arg k "$OPENAI_API_KEY" '. + {openaiApiKey: $k}')
[[ -n "${META_ACCESS_TOKEN:-}" ]] && CREDS=$(echo "$CREDS" | jq --arg k "$META_ACCESS_TOKEN" '. + {metaAccessToken: $k}')
[[ -n "${INSTAGRAM_ACCESS_TOKEN:-}" ]] && CREDS=$(echo "$CREDS" | jq --arg k "$INSTAGRAM_ACCESS_TOKEN" '. + {instagramAccessToken: $k}')
[[ -n "${INSTAGRAM_USER_ID:-}" ]] && CREDS=$(echo "$CREDS" | jq --arg k "$INSTAGRAM_USER_ID" '. + {instagramUserId: $k}')

if [[ "$CREDS" != "{}" ]]; then
  curl -sf -X PATCH "$BASE_URL/api/tenants/$TENANT_ID/credentials" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "$CREDS" &>/dev/null
  ok "Credentials saved ($(echo "$CREDS" | jq -r 'keys | join(", ")'))"
else
  warn "No credential env vars set — skipping (set OPENAI_API_KEY, META_ACCESS_TOKEN, etc.)"
fi

# ── 5. Seed UGC flow ──────────────────────────────────────────────────────────
step "5/8  Seeding UGC Creator Outreach flow..."

META_PAGE_ID_VALUE="${META_PAGE_ID:-\$.input.metaPageId}"

UGC_FLOW=$(cat <<EOF
{
  "name": "UGC Creator Outreach",
  "description": "Brand research → Meta ads analysis → Creator discovery → Personalised DMs",
  "steps": [
    {
      "ref": "trigger",
      "type": "trigger/manual",
      "name": "Manual Trigger",
      "position": 0,
      "config": {
        "inputSchema": {
          "properties": {
            "websiteUrl": { "type": "string", "description": "Brand website URL" },
            "metaPageId": { "type": "string", "description": "Facebook Page ID" }
          }
        }
      }
    },
    {
      "ref": "brand-research",
      "type": "brand-research",
      "name": "Brand Research",
      "position": 1,
      "config": { "websiteUrl": "\$.input.websiteUrl", "extraPaths": ["/about", "/products"] },
      "onSuccess": "meta-ads"
    },
    {
      "ref": "meta-ads",
      "type": "meta-ads-search",
      "name": "Meta Ads Search",
      "position": 2,
      "config": { "pageIdPath": "\$.input.metaPageId", "countries": ["US"], "limit": 20 },
      "onSuccess": "find-creators"
    },
    {
      "ref": "find-creators",
      "type": "agent",
      "name": "Find Instagram Creators",
      "position": 3,
      "config": {
        "agentName": "ugcResearchAgent",
        "systemPrompt": "You are an expert UGC creator sourcing specialist. Use real Instagram data — hashtag searches and profile lookups — to find creators who genuinely fit a brand's niche, tone, and target audience. Never invent handles. Always verify with tools before recommending.",
        "promptTemplate": "Brand: {{$.steps.brand-research.title}}\nDescription: {{$.steps.brand-research.description}}\nTone: {{$.steps.brand-research.tone}}\nTarget audience: {{$.steps.brand-research.targetAudience}}\nUGC ads found: {{$.steps.meta-ads.ugcAds}}\nExisting creator handles: {{$.steps.meta-ads.handles}}\n\nFind 5 Instagram creators who would be a great fit for a UGC partnership with this brand. For each, return: handle, recipientId, followerCount, bio, niche, whyFit. Return as a JSON array.",
        "tools": [
          { "name": "search_instagram_creators", "type": "builtin", "builtinId": "search-instagram-creators", "description": "Search Instagram hashtags for creator handles", "inputSchema": { "properties": { "hashtag": { "type": "string" }, "limit": { "type": "number" } } } },
          { "name": "instagram_profile", "type": "builtin", "builtinId": "instagram-profile", "description": "Get a creator's Instagram profile", "inputSchema": { "properties": { "handle": { "type": "string" } } } }
        ]
      },
      "onSuccess": "send-dms"
    },
    {
      "ref": "send-dms",
      "type": "agent",
      "name": "Send Instagram DMs",
      "position": 4,
      "config": {
        "agentName": "ugcOutreachAgent",
        "systemPrompt": "You are an expert UGC outreach copywriter. Write concise, genuine, personalised DMs that feel human — not templated. Keep messages under 300 characters. Always use send_instagram_dm to actually send each message.",
        "promptTemplate": "Brand: {{$.steps.brand-research.title}}\nDescription: {{$.steps.brand-research.description}}\nTone: {{$.steps.brand-research.tone}}\n\nCreators to contact:\n{{$.steps.find-creators.text}}\n\nWrite and send a personalised DM to each creator. Mention something specific to their content. Introduce the brand. Pitch a UGC collaboration. End with a soft CTA. Under 300 chars each.",
        "tools": [
          { "name": "send_instagram_dm", "type": "builtin", "builtinId": "send-instagram-dm", "description": "Send a DM to an Instagram user", "inputSchema": { "properties": { "recipientId": { "type": "string" }, "message": { "type": "string" } } } }
        ]
      }
    }
  ]
}
EOF
)

# Check if flow already exists
EXISTING=$(curl -sf "$BASE_URL/api/tenants/$TENANT_ID/flows" -H "$AUTH_HEADER" | \
  jq -r '.[] | select(.name == "UGC Creator Outreach") | .id' | head -1)

if [[ -n "$EXISTING" ]]; then
  FLOW_ID="$EXISTING"
  ok "Flow already exists: $FLOW_ID"
else
  CREATE_RESP=$(curl -sf -X POST "$BASE_URL/api/tenants/$TENANT_ID/flows" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "$UGC_FLOW")
  FLOW_ID=$(echo "$CREATE_RESP" | jq -r '.id // empty')
  [[ -z "$FLOW_ID" ]] && die "Failed to create flow: $CREATE_RESP"
  ok "Flow created: $FLOW_ID"
fi

# ── 6. Execute the flow ───────────────────────────────────────────────────────
step "6/8  Executing flow with input..."
info "websiteUrl: $WEBSITE_URL"
[[ -n "$META_PAGE_ID" ]] && info "metaPageId: $META_PAGE_ID"

EXECUTE_PAYLOAD=$(jq -n \
  --arg url "$WEBSITE_URL" \
  --arg pid "$META_PAGE_ID" \
  '{websiteUrl: $url, metaPageId: (if $pid != "" then $pid else null end)}')

EXEC_RESP=$(curl -sf -X POST "$BASE_URL/api/tenants/$TENANT_ID/flows/$FLOW_ID/execute" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "$EXECUTE_PAYLOAD")

WORKFLOW_ID=$(echo "$EXEC_RESP" | jq -r '.workflowId // empty')
[[ -z "$WORKFLOW_ID" ]] && die "Execution failed: $EXEC_RESP"
ok "Workflow started: $WORKFLOW_ID"

# ── 7. Poll for completion ────────────────────────────────────────────────────
step "7/8  Polling workflow status..."
info "Temporal UI: http://localhost:8080/namespaces/default/workflows/$WORKFLOW_ID"

POLL_INTERVAL=5
MAX_WAIT=300
ELAPSED=0

while true; do
  STATUS_RESP=$(curl -sf "$BASE_URL/api/tenants/$TENANT_ID/flows/$FLOW_ID/executions/$WORKFLOW_ID" \
    -H "$AUTH_HEADER" 2>/dev/null || echo '{"status":"UNKNOWN"}')
  STATUS=$(echo "$STATUS_RESP" | jq -r '.status // "UNKNOWN"')
  CONTEXT=$(echo "$STATUS_RESP" | jq -r '.context // null')

  case "$STATUS" in
    COMPLETED)
      ok "Workflow COMPLETED"
      break
      ;;
    FAILED|TERMINATED|CANCELED|TIMED_OUT)
      die "Workflow ended with status: $STATUS"
      ;;
    *)
      # Show current step from live context if available
      CURRENT_STEP=$(echo "$CONTEXT" | jq -r 'if . then (.steps | keys | last) else "starting..." end' 2>/dev/null || echo "starting...")
      echo -ne "\r  ${CYAN}[${ELAPSED}s] status=${STATUS} last_step=${CURRENT_STEP}${RESET}    "
      ;;
  esac

  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
  if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    warn "Timed out after ${MAX_WAIT}s — workflow may still be running"
    warn "Check: http://localhost:8080/namespaces/default/workflows/$WORKFLOW_ID"
    break
  fi
done
echo

# ── 8. Print results ──────────────────────────────────────────────────────────
step "8/8  Results"

FINAL=$(curl -sf "$BASE_URL/api/tenants/$TENANT_ID/flows/$FLOW_ID/executions/$WORKFLOW_ID" \
  -H "$AUTH_HEADER" 2>/dev/null || echo '{}')

echo -e "\n${BLUE}── Workflow ID ──────────────────────────────────────${RESET}"
echo "  $WORKFLOW_ID"

echo -e "\n${BLUE}── Step outputs ─────────────────────────────────────${RESET}"
echo "$FINAL" | jq -r '.context.steps // {} | to_entries[] | "  \(.key): \(.value | tostring | .[0:120])"' 2>/dev/null || true

echo -e "\n${BLUE}── Temporal UI ──────────────────────────────────────${RESET}"
echo "  http://localhost:8080/namespaces/default/workflows/$WORKFLOW_ID"

echo -e "\n${GREEN}✓ Walkthrough complete!${RESET}\n"
