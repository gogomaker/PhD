#!/bin/bash
# Supabase 관리 API로 SQL 파일을 실행한다. 마이그레이션 적용과 DB 테스트에 쓴다.
# 필요: 환경 변수 SUPABASE_ACCESS_TOKEN
# 사용: scripts/db.sh supabase/migrations/xxx.sql
#       scripts/db.sh supabase/tests/m1_accounts.sql
set -euo pipefail
REF=vvhpabbqiguuobpivdbf
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN 환경 변수가 필요해요}"
jq -n --rawfile q "$1" '{query: $q}' |
  curl -sS -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'content-type: application/json' --data-binary @-
echo
