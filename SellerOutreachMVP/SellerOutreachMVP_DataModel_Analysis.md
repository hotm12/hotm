# SellerOutreachMVP_DataModel_Analysis

## 목적
- 핵심 데이터 구조와 상태 모델을 정리한다.

## 핵심 테이블
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

## 핵심 상태
### lead_status
- NEW
- REVIEW_READY
- APPROVED
- ON_HOLD
- REJECTED

### crm_stage
- CONTACTED
- REPLIED
- INTERESTED
- MEETING_BOOKED
- ONBOARDING
- LISTING_IN_PROGRESS
- CLOSED_WON
- CLOSED_LOST

## 설계 원칙
- 설정 데이터와 운영 데이터를 분리한다.
- 상태값은 문자열로 명시 저장한다.
- 점수 근거와 체크리스트 결과는 나중에 추적 가능해야 한다.
