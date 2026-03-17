# SellerOutreachMVP_SQLDraft_Analysis

## 목적
- PostgreSQL 기준으로 SellerOutreachMVP의 1차 테이블 초안을 빠르게 시작할 수 있게 정리한다.
- 실제 마이그레이션 작성 전에 핵심 컬럼, 제약, 인덱스 방향을 고정한다.

## 전제
- 상태값은 문자열로 저장한다.
- 시간은 `TIMESTAMPTZ`를 사용한다.
- 설정 데이터와 운영 데이터를 분리한다.
- 추적 가능한 운영 이력이 중요하다.

## 상태값 초안
### lead_status
- `NEW`
- `REVIEW_READY`
- `APPROVED`
- `ON_HOLD`
- `REJECTED`
- `DO_NOT_CONTACT`

### crm_stage
- `CONTACTED`
- `REPLIED`
- `INTERESTED`
- `MEETING_BOOKED`
- `ONBOARDING`
- `LISTING_IN_PROGRESS`
- `CLOSED_WON`
- `CLOSED_LOST`

### outreach_delivery_status
- `DRAFT`
- `APPROVED`
- `QUEUED`
- `SENT`
- `FAILED`
- `CANCELED`

## DDL 초안
```sql
create table campaigns (
  id bigserial primary key,
  name varchar(120) not null,
  category varchar(80),
  target_platform varchar(40) not null,
  outreach_channel_priority varchar(20) not null,
  status varchar(20) not null default 'ACTIVE',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaign_sources (
  id bigserial primary key,
  campaign_id bigint not null references campaigns(id) on delete cascade,
  source_type varchar(40) not null,
  source_value varchar(255) not null,
  notes text,
  created_at timestamptz not null default now()
);

create table campaign_filters (
  id bigserial primary key,
  campaign_id bigint not null references campaigns(id) on delete cascade,
  filter_type varchar(40) not null,
  operator varchar(20) not null,
  filter_value varchar(255) not null,
  created_at timestamptz not null default now()
);

create table scoring_rule_sets (
  id bigserial primary key,
  campaign_id bigint not null references campaigns(id) on delete cascade,
  name varchar(120) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table scoring_rules (
  id bigserial primary key,
  rule_set_id bigint not null references scoring_rule_sets(id) on delete cascade,
  rule_name varchar(120) not null,
  score_delta integer not null,
  rule_type varchar(40) not null,
  condition_json jsonb not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table review_checklist_templates (
  id bigserial primary key,
  campaign_id bigint not null references campaigns(id) on delete cascade,
  name varchar(120) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table review_checklist_items (
  id bigserial primary key,
  template_id bigint not null references review_checklist_templates(id) on delete cascade,
  label varchar(255) not null,
  item_type varchar(30) not null default 'BOOLEAN',
  is_required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table leads (
  id bigserial primary key,
  campaign_id bigint not null references campaigns(id) on delete restrict,
  platform varchar(40) not null,
  handle varchar(120) not null,
  display_name varchar(255),
  bio text,
  category varchar(80),
  follower_count integer,
  post_count integer,
  lead_status varchar(30) not null default 'NEW',
  crm_stage varchar(40),
  risk_flags jsonb not null default '[]'::jsonb,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, handle)
);

create table contacts (
  id bigserial primary key,
  lead_id bigint not null references leads(id) on delete cascade,
  contact_type varchar(30) not null,
  contact_value varchar(255) not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table lead_posts (
  id bigserial primary key,
  lead_id bigint not null references leads(id) on delete cascade,
  platform_post_id varchar(120),
  post_url text,
  caption text,
  posted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table lead_scores (
  id bigserial primary key,
  lead_id bigint not null references leads(id) on delete cascade,
  rule_set_id bigint not null references scoring_rule_sets(id) on delete restrict,
  total_score integer not null,
  score_grade varchar(20),
  score_breakdown jsonb not null,
  calculated_at timestamptz not null default now()
);

create table review_checklist_answers (
  id bigserial primary key,
  lead_id bigint not null references leads(id) on delete cascade,
  checklist_item_id bigint not null references review_checklist_items(id) on delete restrict,
  answer_value varchar(255),
  note text,
  reviewed_by varchar(120),
  reviewed_at timestamptz not null default now()
);

create table outreach_messages (
  id bigserial primary key,
  lead_id bigint not null references leads(id) on delete cascade,
  channel varchar(20) not null,
  subject varchar(255),
  body text not null,
  delivery_status varchar(30) not null default 'DRAFT',
  approved_by varchar(120),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table replies (
  id bigserial primary key,
  lead_id bigint not null references leads(id) on delete cascade,
  outreach_message_id bigint references outreach_messages(id) on delete set null,
  channel varchar(20) not null,
  reply_type varchar(40),
  message_body text,
  received_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table activities (
  id bigserial primary key,
  lead_id bigint not null references leads(id) on delete cascade,
  activity_type varchar(40) not null,
  summary varchar(255) not null,
  detail text,
  actor varchar(120),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table amazon_onboarding (
  id bigserial primary key,
  lead_id bigint not null unique references leads(id) on delete cascade,
  onboarding_status varchar(40) not null,
  next_action varchar(255),
  notes text,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

create table audit_logs (
  id bigserial primary key,
  entity_type varchar(60) not null,
  entity_id bigint not null,
  action_type varchar(40) not null,
  actor varchar(120),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index idx_leads_platform on leads(platform);
create index idx_leads_status on leads(lead_status);
create index idx_leads_crm_stage on leads(crm_stage);
create index idx_outreach_messages_status on outreach_messages(delivery_status);
create index idx_replies_lead_id on replies(lead_id);
create index idx_activities_lead_id on activities(lead_id);
```

## 테이블 설명
### 설정 데이터
- `campaigns`: 캠페인 단위 설정 루트
- `campaign_sources`: 키워드, 해시태그, 시드 계정 등 입력
- `campaign_filters`: 제외 조건, 최소 기준 저장
- `scoring_rule_sets`, `scoring_rules`: 점수 계산 규칙
- `review_checklist_templates`, `review_checklist_items`: 검수 기준

### 운영 데이터
- `leads`: 후보 셀러 마스터
- `contacts`: 이메일, DM 가능 채널
- `lead_posts`: 공개 게시물 단위 참고 데이터
- `lead_scores`: 계산 결과와 근거
- `review_checklist_answers`: 검수 결과
- `outreach_messages`: 이메일/DM 초안 및 발송 상태
- `replies`: 답장 기록
- `activities`: 수동 액션과 운영 메모
- `amazon_onboarding`: 온보딩 상태
- `audit_logs`: 변경 추적

## 제약 조건 권장안
- `platform + handle` 유니크 유지
- `DO_NOT_CONTACT` 리드는 발송 차단
- 승인 전 `outreach_messages`를 `SENT`로 바꾸지 않도록 서비스 레이어에서 통제
- 온보딩은 리드당 1건 유지

## 다음 작업
1. ORM 모델로 변환
2. 마이그레이션 파일 작성
3. Enum 상수 분리
4. 시드 데이터 작성

## 관련 문서
- `SellerOutreachMVP_DDL_Analysis.md`
- `SellerOutreachMVP_DataModel_Analysis.md`
- `SellerOutreachMVP_ExecutionRoadmap_Analysis.md`
