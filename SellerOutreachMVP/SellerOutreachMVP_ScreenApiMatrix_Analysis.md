# SellerOutreachMVP_ScreenApiMatrix_Analysis

## 목적
- 화면별로 필요한 API와 데이터 책임을 한눈에 볼 수 있게 정리한다.
- 프론트엔드와 백엔드가 동시에 작업할 때 누락 없이 연결할 수 있게 한다.

## 사용 원칙
- 한 화면에서 필요한 조회 API와 액션 API를 분리한다.
- 리스트 화면은 필터와 정렬 파라미터를 먼저 정의한다.
- 상세 화면은 핵심 요약과 액션 패널을 동시에 고려한다.

## 화면별 API 매핑
### 1. 대시보드
- 목적
  - 전체 운영 현황, 오늘 할 일, 최근 답장을 빠르게 본다.
- 조회 API
  - `GET /dashboard/kpis`
  - `GET /dashboard/tasks`
  - `GET /dashboard/recent-replies`
- 액션 API
  - 없음 또는 리드/CRM 상세 이동 중심
- 주요 데이터
  - 신규 리드 수
  - 검수 대기 수
  - 발송 대기 수
  - 최근 답장 목록

### 2. 설정 페이지
- 목적
  - 캠페인, 후보 기준, 점수표, 체크리스트를 관리한다.
- 조회 API
  - `GET /campaigns`
  - `GET /campaigns/:id`
  - `GET /campaigns/:id/sources`
  - `GET /campaigns/:id/filters`
  - `GET /campaigns/:id/scoring-rule-set`
  - `GET /campaigns/:id/review-checklist-template`
- 액션 API
  - `POST /campaigns`
  - `PATCH /campaigns/:id`
  - `POST /campaigns/:id/sources`
  - `POST /campaigns/:id/filters`
  - `PUT /campaigns/:id/scoring-rule-set`
  - `PUT /campaigns/:id/review-checklist-template`
- 주요 데이터
  - 캠페인 기본 정보
  - 소스 목록
  - 필터 목록
  - 점수 규칙
  - 체크리스트 항목

### 3. 리드 리스트
- 목적
  - 후보 셀러를 검색하고 우선순위를 판단한다.
- 조회 API
  - `GET /leads`
- 액션 API
  - `POST /leads`
  - `POST /leads/recalculate-scores`
- 주요 쿼리 파라미터
  - `campaignId`
  - `platform`
  - `leadStatus`
  - `crmStage`
  - `scoreMin`
  - `keyword`
  - `page`
  - `pageSize`
- 주요 데이터
  - 기본 프로필
  - 점수 요약
  - 상태 뱃지
  - 위험 신호

### 4. 리드 상세
- 목적
  - 특정 리드의 근거 데이터와 다음 액션을 확인한다.
- 조회 API
  - `GET /leads/:id`
  - `GET /leads/:id/score`
  - `GET /leads/:id/activities`
  - `GET /leads/:id/outreach-messages`
- 액션 API
  - `POST /leads/:id/recalculate-score`
  - `POST /leads/:id/review`
- 주요 데이터
  - 프로필 요약
  - 연락처
  - 게시물
  - 점수 근거
  - 검수 상태

### 5. 검수 큐
- 목적
  - 검수 대기 리드를 빠르게 승인/보류/제외한다.
- 조회 API
  - `GET /review-queue`
- 액션 API
  - `POST /leads/:id/review`
- 주요 데이터
  - 리드 카드 목록
  - 체크리스트 요약
  - 위험 신호
  - 빠른 의사결정 버튼

### 6. 아웃리치 큐
- 목적
  - 승인된 리드의 메시지 초안과 발송 준비를 관리한다.
- 조회 API
  - `GET /outreach-queue`
  - `GET /leads/:id/outreach-preview`
- 액션 API
  - `POST /outreach/preview`
  - `POST /outreach/:id/approve`
  - `POST /outreach/:id/send-email`
  - `POST /outreach/:id/queue-dm`
- 주요 데이터
  - 채널별 큐
  - 초안 본문
  - 승인 여부
  - 발송 상태

### 7. CRM 보드
- 목적
  - 답장 이후 단계를 칸반 형태로 관리한다.
- 조회 API
  - `GET /crm/board`
  - `GET /leads/:id/activities`
  - `GET /leads/:id/replies`
- 액션 API
  - `POST /replies`
  - `POST /crm/move-stage`
  - `POST /activities`
- 주요 데이터
  - 단계별 카드 목록
  - 최근 활동
  - 답장 유형
  - 다음 후속 액션

### 8. 온보딩 상세
- 목적
  - 관심 셀러의 실제 진행 상태를 추적한다.
- 조회 API
  - `GET /onboarding/:leadId`
- 액션 API
  - `POST /onboarding/start`
  - `PATCH /onboarding/:leadId`
  - `POST /activities`
- 주요 데이터
  - 온보딩 상태
  - 체크리스트
  - 메모
  - 다음 액션

## 공통 DTO 권장 묶음
- `CampaignCreateRequest`, `CampaignResponse`
- `LeadImportRequest`, `LeadSummaryDto`, `LeadDetailResponse`
- `ScoreResponse`
- `LeadReviewSubmitRequest`, `LeadReviewSubmitResponse`
- `OutreachPreviewRequest`, `OutreachPreviewResponse`
- `QueueDmRequest`, `SendEmailRequest`
- `ReplyImportRequest`, `ReplyResponse`
- `MoveCrmStageRequest`
- `StartOnboardingRequest`, `UpdateOnboardingRequest`, `OnboardingResponse`

## 프론트 우선 구현 순서
1. 설정 페이지
2. 리드 리스트
3. 리드 상세
4. 검수 큐
5. 아웃리치 큐
6. CRM 보드
7. 온보딩 상세
8. 대시보드

## 백엔드 우선 구현 순서
1. 캠페인/설정 API
2. 리드 목록/상세 API
3. 점수 API
4. 검수 API
5. 아웃리치 API
6. CRM API
7. 온보딩 API
8. 대시보드 API

## 화면과 API 연결 시 주의점
- 검수 전에는 아웃리치 액션이 노출되면 안 된다.
- `DO_NOT_CONTACT` 상태는 여러 화면에서 동일하게 차단되어야 한다.
- CRM 이동은 답장 데이터와 분리하지 말고 활동 로그와 함께 남겨야 한다.
- 점수는 리스트 요약과 상세 근거가 서로 어긋나지 않아야 한다.

## 관련 문서
- `SellerOutreachMVP_UIFlow_Analysis.md`
- `SellerOutreachMVP_API_Analysis.md`
- `SellerOutreachMVP_API_DTO_Analysis.md`
- `SellerOutreachMVP_ExecutionRoadmap_Analysis.md`
