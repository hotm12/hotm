# SellerOutreachMVP_DDL_Analysis

## 목적
- PostgreSQL 기준 최종 DDL 방향을 정리한다.

## 기준
- PostgreSQL 우선
- 시간은 `TIMESTAMPTZ` 사용
- 상태값은 문자열 Enum으로 관리
- 핵심 조회 필드는 일반 컬럼으로 둔다.

## 포함 테이블
- campaigns
- campaign_sources
- campaign_filters
- scoring_rule_sets
- scoring_rules
- review_checklist_templates
- review_checklist_items
- leads
- contacts
- lead_posts
- lead_scores
- review_checklist_answers
- outreach_messages
- replies
- activities
- amazon_onboarding
- audit_logs

## 핵심 제약
- `platform + handle` 유니크
- 승인 전 발송 금지
- `DO_NOT_CONTACT` 대상 발송 금지

## 인덱스 우선순위
- leads(platform)
- leads(lead_status)
- leads(crm_stage)
- outreach_messages(delivery_status)
- replies(lead_id)
