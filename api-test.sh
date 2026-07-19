#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:8080/api"
PASS=0
FAIL=0
FAILURES=""

JWT_HEADER=$(echo -n '{"alg":"HS256","typ":"JWT"}' | base64 -w0)
JWT_PAYLOAD=$(echo -n '{"sub":"test-clerk-id-e2e"}' | base64 -w0)
JWT="${JWT_HEADER}.${JWT_PAYLOAD}.fakesignature"
AUTH="Authorization: Bearer $JWT"

check() {
  local label="$1" method="$2" url="$3" expected="$4" body="${5:-}"
  sleep 0.3
  local response
  if [ -n "$body" ]; then
    response=$(curl -s -o /tmp/api-resp.txt -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" -H "$AUTH" -d "$body" 2>/dev/null || true)
  else
    response=$(curl -s -o /tmp/api-resp.txt -w "%{http_code}" -X "$method" "$url" \
      -H "$AUTH" 2>/dev/null || true)
  fi
  local response_body
  response_body=$(cat /tmp/api-resp.txt 2>/dev/null || echo "")
  if [ "$response" = "$expected" ]; then
    echo "  ✓ $label ($method $url → $response)"
    PASS=$((PASS+1))
  else
    local snippet
    snippet=$(echo "$response_body" | head -c 200)
    echo "  ✗ $label ($method $url → $response, expected $expected)"
    echo "    Body: $snippet"
    FAIL=$((FAIL+1))
    FAILURES="$FAILURES  - $label\n"
  fi
}

echo "=== Starting API Tests ==="
echo ""

# ── Server Health ──
echo "── Health & Server ──"
check "Health check" GET "http://localhost:8080/health" 200
check "Root endpoint" GET "http://localhost:8080/" 200

# Get candidate IDs early (lightweight, no rate limit concern)
CAND_ALL=$(curl -s "$BASE/candidates?page=1&limit=10" -H "$AUTH" 2>/dev/null || echo '{"data":[]}')
FIRST_CAND=$(echo "$CAND_ALL" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data',{})
candidates=data.get('candidates',[]) or data.get('data',[])
if candidates and len(candidates)>0:
    print(candidates[0].get('id',''))
" 2>/dev/null || echo "")
CAND_IDS=$(echo "$CAND_ALL" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data',{})
candidates=data.get('candidates',[]) or data.get('data',[])
ids=[c.get('id') for c in candidates if c.get('id')]
print(json.dumps(ids[:3]))
" 2>/dev/null || echo "[]")
echo "  First candidate ID: $FIRST_CAND"
echo "  Candidate IDs: $CAND_IDS"

# ── AI Search (hit LLM paths early before rate limit builds up) ──
echo ""
echo "── AI Search ──"
sleep 2
check "Search candidates" POST "$BASE/candidates/search" 200 \
  '{"jdText":"Senior Software Engineer React TypeScript","limit":5}'

sleep 2
check "Compare candidates" POST "$BASE/candidates/compare" 200 \
  "{\"jdText\":\"Senior Software Engineer React TypeScript\",\"candidateIds\":$CAND_IDS}"

# ── Candidate CRUD ──
echo ""
echo "── Candidates ──"
check "List candidates (page 1)" GET "$BASE/candidates?page=1&limit=5" 200
check "Candidates page" GET "$BASE/candidates-page?page=1&limit=5" 200

if [ -n "$FIRST_CAND" ]; then
  check "Get single candidate" GET "$BASE/candidates/$FIRST_CAND" 200
  check "Candidate brief" GET "$BASE/candidates/$FIRST_CAND/brief" 200
  check "Similar candidates" GET "$BASE/candidates/$FIRST_CAND/similar" 200
  check "Candidate timeline" GET "$BASE/candidates/$FIRST_CAND/timeline" 200
  check "Candidate notes" GET "$BASE/candidates/$FIRST_CAND/notes" 200
  check "Candidate interviews" GET "$BASE/candidates/$FIRST_CAND/interviews" 200

  check "Add note" POST "$BASE/candidates/$FIRST_CAND/notes" 201 \
    '{"noteText":"Test note from e2e"}'

  check "Screening questions" POST "$BASE/candidates/$FIRST_CAND/screening-questions" 200 \
    '{"jdText":"Senior Software Engineer with React and Node.js"}'

  check "Closing strategy" POST "$BASE/candidates/$FIRST_CAND/closing-strategy" 200 \
    '{"jdText":"Senior Software Engineer"}'

  check "Email template" POST "$BASE/candidates/$FIRST_CAND/email-template" 200 \
    '{"type":"interview"}'

  check "Update status to Screening" PATCH "$BASE/candidates/$FIRST_CAND/status" 200 \
    '{"status":"Screening"}'

  check "Update status to Interview Scheduled" PATCH "$BASE/candidates/$FIRST_CAND/status" 200 \
    '{"status":"Interview Scheduled"}'

  check "Offer" POST "$BASE/candidates/$FIRST_CAND/offer" 200 \
    '{"salary":150000,"joiningDate":"2026-08-01","notes":"Great candidate"}'

  check "Update status to Offered" PATCH "$BASE/candidates/$FIRST_CAND/status" 200 \
    '{"status":"Offered"}'

  check "Accept offer" POST "$BASE/candidates/$FIRST_CAND/accept-offer" 200 \
    '{"acceptanceNotes":"Accepted!"}'

  check "Reset to Applied" PATCH "$BASE/candidates/$FIRST_CAND/status" 200 \
    '{"status":"Applied"}'
else
  echo "  ⚠ No candidates found — skipping candidate-specific tests"
fi

# ── Sessions ──
echo ""
echo "── Sessions ──"
sleep 2
SESS_RESP=$(curl -s -X POST "$BASE/generate-link" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"jdText":"Senior Software Engineer with 5+ years React, Node.js, TypeScript"}' 2>/dev/null || echo '{"success":false}')
SESS_ID=$(echo "$SESS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','no-session-id'))" 2>/dev/null || echo "no-session-id")
echo "  Session ID: $SESS_ID"

check "List sessions" GET "$BASE/sessions" 200
if [ -n "$SESS_ID" ] && [ "$SESS_ID" != "no-session-id" ]; then
  check "Get session" GET "$BASE/sessions/$SESS_ID" 200
  check "Session stats" GET "$BASE/sessions/$SESS_ID/stats" 200
fi

# ── Saved Searches ──
echo ""
echo "── Saved Searches ──"
check "List saved searches" GET "$BASE/saved-searches" 200
check "Create saved search" POST "$BASE/saved-searches" 201 \
  '{"name":"Test Search E2E","jdText":"Senior React Developer with TypeScript","filters":{}}'

SS_ID=$(curl -s "$BASE/saved-searches" -H "$AUTH" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data',[])
if data and len(data)>0:
    print(data[-1].get('id',''))
" 2>/dev/null || echo "")
echo "  Saved search ID: $SS_ID"
if [ -n "$SS_ID" ]; then
  sleep 1
  check "Update saved search" PUT "$BASE/saved-searches/$SS_ID" 200 \
    '{"name":"Updated Test Search","is_favorite":true}'
  check "Delete saved search" DELETE "$BASE/saved-searches/$SS_ID" 200
fi

# ── Talent Pools ──
echo ""
echo "── Talent Pools ──"
check "List talent pools" GET "$BASE/talent-pools" 200

POOL_RESP=$(curl -s -X POST "$BASE/talent-pools" -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Test Pool E2E"}' 2>/dev/null || echo '{"success":false}')
POOL_ID=$(echo "$POOL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null || echo "")
echo "  Pool ID: $POOL_ID"
if [ -n "$POOL_ID" ]; then
  sleep 1
  check "Get pool detail" GET "$BASE/talent-pools/$POOL_ID" 200
  check "Update pool" PUT "$BASE/talent-pools/$POOL_ID" 200 '{"name":"Updated Test Pool"}'
  if [ -n "$FIRST_CAND" ]; then
    check "Add candidate to pool" POST "$BASE/talent-pools/$POOL_ID/candidates" 200 \
      "{\"candidateId\":\"$FIRST_CAND\",\"matchScore\":0.85}"
    check "Remove candidate from pool" DELETE "$BASE/talent-pools/$POOL_ID/candidates/$FIRST_CAND" 200
  fi
  check "Delete pool" DELETE "$BASE/talent-pools/$POOL_ID" 200
fi

# ── Search History ──
echo ""
echo "── Search History ──"
check "List search history" GET "$BASE/search-history" 200

# ── Recruiter Activity ──
echo ""
echo "── History / Activity ──"
check "List history" GET "$BASE/history?page=1&limit=10" 200
check "History with type filter" GET "$BASE/history?actionType=search_executed" 200
check "History with search" GET "$BASE/history?search=test" 200

# ── Dashboard ──
echo ""
echo "── Dashboard ──"
check "Dashboard" GET "$BASE/dashboard" 200

# ── JD Parsing ──
echo ""
echo "── JD Parsing ──"
# Wait for rate limit window to reset
echo "  Waiting 65s for rate limit window to reset..."
sleep 65
check "Parse JD" POST "$BASE/jd/parse" 200 \
  '{"jdText":"We are looking for a Senior Software Engineer with 5+ years of experience in React, Node.js, TypeScript, and PostgreSQL."}'

# ── Bias Scan ──
echo ""
echo "── Bias Scan ──"
sleep 5
check "Scan bias" POST "$BASE/scan-bias" 200 \
  '{"jdText":"We need a young and energetic software engineer who can hit the ground running."}'

# ── Batch ──
echo ""
echo "── Batch / Misc ──"
if [ "$CAND_IDS" != "[]" ]; then
  check "Batch candidates" POST "$BASE/candidates/batch" 200 "{\"ids\":$CAND_IDS}"
else
  echo "  ⚠ No candidate IDs for batch test"
fi

# ── Summary ──
echo ""
echo "═══════════════════════════════════"
echo "  Tests: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════"
if [ $FAIL -gt 0 ]; then
  echo ""
  echo "Failures:"
  echo -e "$FAILURES"
  exit 1
fi
exit 0
