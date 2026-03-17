# Seller Find

SellerOutreachMVP 설계 문서를 기준으로 시작한 내부 운영 도구 프로젝트다.

## 구조
- `SellerOutreachMVP`: 기획/설계 문서
- `apps/web`: 운영자용 프론트엔드
- `apps/api`: 백엔드 API
- `packages/db`: Prisma 스키마와 공통 상태값

## 시작 기준
- 프론트엔드: Next.js
- 백엔드: NestJS
- 데이터베이스: PostgreSQL
- 패키지 구조: npm workspaces

## 다음 작업
1. 의존성 설치
2. Prisma 마이그레이션 생성
3. 설정 도메인 이후 `리드 -> 점수 -> 검수` 순서로 확장
4. Next.js 화면과 API 연결 고도화

## 현재 구현 범위
- `apps/api`에 캠페인 설정 CRUD와 소스/필터/점수규칙/체크리스트 API 초안 구현
- `apps/api`에 리드 목록/상세/등록/점수 재계산 API 초안 구현
- `apps/web/app/settings`에 설정 화면 초안 구현
- `apps/web/app/leads`에 필터/목록/상세/빠른 등록 화면 초안 구현
- `packages/db/prisma/schema.prisma`에 MVP 데이터 모델 초안 반영
