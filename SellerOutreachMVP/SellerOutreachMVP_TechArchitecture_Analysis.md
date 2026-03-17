# SellerOutreachMVP_TechArchitecture_Analysis

## 목적
- SellerOutreachMVP를 실제로 구현하기 위한 권장 기술스택과 시스템 구조를 정리한다.
- 아직 기술 선택이 고정되지 않은 상태에서 빠르게 개발을 시작할 수 있는 현실적인 기본안을 제안한다.

## 전제
- 내부 운영 도구 MVP를 우선 만든다.
- 자동화보다 수동 검수와 상태 관리가 더 중요하다.
- 운영자 UI, API, DB가 빠르게 함께 움직일 수 있어야 한다.
- 첫 버전은 대규모 트래픽보다 개발 속도와 유지보수성을 우선한다.

## 권장 기술스택
### 프론트엔드
- Next.js
- TypeScript
- App Router
- React Query 또는 TanStack Query
- Tailwind CSS
- React Hook Form
- Zod

### 백엔드
- NestJS
- TypeScript
- Prisma 또는 TypeORM
- REST API
- class-validator 또는 Zod 기반 검증

### 데이터베이스
- PostgreSQL
- `TIMESTAMPTZ` 사용
- 상태값은 문자열 Enum 방식으로 저장

### 인프라
- Vercel 또는 정적/서버 혼합 배포 가능한 프론트 환경
- Railway, Render, Fly.io 또는 사내 VM 기반 API/DB 운영
- S3 호환 스토리지 필요 시 메시지 초안 첨부파일 저장용으로 확장

## 왜 이 조합이 적합한가
- TypeScript 단일 언어로 프론트와 백엔드 문맥을 맞출 수 있다.
- CRUD, 폼, 상태 표시가 많은 운영도구에 Next.js와 NestJS 조합이 안정적이다.
- PostgreSQL은 상태 관리, 이력 저장, 필터링, 검색 조건 처리에 적합하다.
- REST API는 현재 문서 구조와 DTO 설계 방향에 가장 잘 맞는다.

## 권장 시스템 구조
### 클라이언트
- 운영자 화면
- 공통 레이아웃
- 리스트/상세/큐/보드 UI
- 폼 입력과 검증

### API 서버
- 인증/권한
- 캠페인/설정
- 리드
- 점수 계산
- 검수
- 아웃리치
- CRM
- 온보딩
- 감사 로그

### 데이터 계층
- PostgreSQL
- ORM
- 마이그레이션
- 시드 데이터

## 권장 모듈 구조
### 프론트엔드 모듈
- `app/(dashboard)`
- `app/leads`
- `app/review`
- `app/outreach`
- `app/crm`
- `app/onboarding`
- `app/settings`
- `components/common`
- `components/leads`
- `components/review`
- `components/outreach`
- `components/crm`
- `components/onboarding`
- `lib/api`
- `lib/forms`
- `lib/constants`

### 백엔드 모듈
- `auth`
- `users`
- `campaigns`
- `campaign-sources`
- `campaign-filters`
- `scoring-rules`
- `review-checklists`
- `leads`
- `lead-scores`
- `outreach`
- `replies`
- `crm`
- `onboarding`
- `activities`
- `audit-logs`

## 권장 데이터 흐름
1. 운영자가 설정 화면에서 캠페인, 규칙, 체크리스트를 정의한다.
2. 리드가 수집 또는 등록되면 `leads`, `contacts`, `lead_posts`에 저장된다.
3. 점수 계산 로직이 규칙 세트를 기준으로 `lead_scores`를 기록한다.
4. 운영자가 검수 큐에서 체크리스트와 상태를 업데이트한다.
5. 승인된 리드만 아웃리치 큐로 이동한다.
6. 발송 또는 DM 처리 결과가 활동 로그와 CRM 단계에 반영된다.
7. 관심 리드는 온보딩으로 전환된다.

## 인증과 권한 권장안
- 최소 4개 역할: 관리자, 리서치 운영자, 아웃리치 담당자, 온보딩 담당자
- RBAC 기반 권한 체크
- 관리자만 설정 도메인 수정 가능
- 검수와 발송 승인 이력은 사용자 단위로 남긴다

## API 설계 원칙
- 리소스 중심 REST API 사용
- 날짜는 ISO 8601 문자열
- 응답은 `data` 래핑 가능 구조 유지
- 실패 응답은 `code`, `message`, `details`
- 상태값은 문서에 정의된 문자열 Enum 그대로 사용

## 화면 설계 원칙
- 리스트 + 상세 + 액션 패널 구조를 기본으로 한다.
- 점수는 총점보다 근거를 먼저 보여준다.
- 승인/보류/제외 같은 고위험 액션은 분명한 버튼과 확인 흐름을 둔다.
- DM은 자동 발송보다 수동 큐 처리 중심으로 만든다.

## 운영도구에 필요한 비기능 요구사항
- 변경 이력 저장
- 감사 로그 저장
- 재연락 금지 대상 차단
- 승인 전 발송 차단
- 검색과 필터 성능 확보
- 장애 시 수동 복구 가능한 상태 구조

## MVP 배포 권장안
### 1단계
- 프론트 1개
- API 서버 1개
- PostgreSQL 1개
- 파일 스토리지 없이 시작

### 2단계
- 배치 점수 계산 작업 분리
- 첨부파일 저장소 추가
- 이메일 연동 서비스 추가

## 향후 확장 포인트
- 리드 수집 크롤러/수동 업로드 배치 분리
- 템플릿 다국어 지원
- 카테고리별 규칙 세트 버전 관리
- AI 기반 메시지 초안 보조
- 운영 성과 대시보드 고도화

## 지금 기준 추천 결론
- 프론트는 Next.js
- 백엔드는 NestJS
- DB는 PostgreSQL
- API는 REST
- 상태와 이력 중심 구조로 먼저 구현

## 관련 문서
- `SellerOutreachMVP_DevSpec_Analysis.md`
- `SellerOutreachMVP_DataModel_Analysis.md`
- `SellerOutreachMVP_API_Analysis.md`
- `SellerOutreachMVP_ExecutionRoadmap_Analysis.md`
