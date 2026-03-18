# Seller Find

Seller outreach MVP를 문서 기반으로 구현 중인 모노레포입니다.

## 구성
- `C:\SellerFind\SellerOutreachMVP`: 기획/설계 문서
- `C:\SellerFind\apps\web`: Next.js 프론트엔드
- `C:\SellerFind\apps\api`: NestJS API
- `C:\SellerFind\packages\db`: Prisma 스키마와 DB 패키지
- `C:\SellerFind\scripts`: Windows 실행 보조 스크립트와 임베디드 PostgreSQL 스크립트

## 현재 구현 범위
- 캠페인 설정 CRUD
- 리드 목록/상세/등록/점수 계산
- 검수 큐 조회와 승인/보류/제외 처리
- 아웃리치 큐, 메시지 미리보기, 승인, 이메일 발송, DM 큐 등록
- CRM 보드, 답장 등록, 단계 이동, 활동 메모
- 온보딩 목록/상세/시작/업데이트
- 운영 대시보드
- 감사 로그 조회

## 실행
1. 의존성 설치
```bash
npm install
```

2. 환경 파일 확인
- `C:\SellerFind\apps\web\.env.local`
- `C:\SellerFind\apps\api\.env`

3. 웹 개발 서버 실행
```bash
npm run dev:web
```

4. API 개발 서버 실행
```bash
npm run dev:api
```

5. Prisma Client 생성
```bash
npm run db:generate
```

6. PostgreSQL 스키마 반영
```bash
npm run db:push
```

## 임베디드 PostgreSQL 개발 모드
관리자 권한 없이 로컬 PostgreSQL 호환 개발 서버를 실행할 수 있습니다.

1. 임베디드 DB 시작
```bash
npm run db:start:embedded
```

2. 임베디드 DB에 Prisma 스키마 반영
```bash
npm run db:push:embedded
```

3. API를 임베디드 DB 모드로 실행
```bash
npm run dev:api:embedded
```

기본 연결 정보
- Host: `127.0.0.1`
- Port: `5432`
- User: `postgres`
- Password: `postgres`
- Database: `seller_find`

기본 주소
- Web: `http://localhost:3000`
- API Health: `http://localhost:3001/api/health`
- API Dashboard: `http://localhost:3001/api/dashboard`
- API Audit Log: `http://localhost:3001/api/audit-log`

## 저장 방식
- `apps/api/.env`에서 `DATABASE_URL`이 비어 있으면 JSON fallback으로 동작합니다.
- `DATABASE_URL`이 있으면 Prisma/PostgreSQL을 우선 사용합니다.
- 현재 `campaigns`, `leads`, `review`, `outreach`, `crm`, `onboarding`, `dashboard`, `audit-log`가 같은 흐름을 따릅니다.

## 참고
- Codex 앱의 PATH 이슈를 피하기 위해 루트 스크립트는 `scripts/run-npm.cmd`, 각 workspace 스크립트는 `scripts/run-with-npm-node.cmd`를 사용합니다.
- API는 `http://localhost:3000`을 기본 허용 Origin으로 설정해두었습니다.
