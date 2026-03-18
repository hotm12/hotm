# SellerOutreachMVP 문서 인덱스

## 목적
이 디렉터리는 Seller Outreach MVP의 요구사항, 데이터 모델, API, 화면 흐름, 실행 로드맵을 한 번에 따라갈 수 있도록 정리한 문서 모음입니다.

## 먼저 읽을 문서
1. [SellerOutreachMVP_FinalBrief_Analysis.md](./SellerOutreachMVP_FinalBrief_Analysis.md)
2. [SellerOutreachMVP_DevSpec_Analysis.md](./SellerOutreachMVP_DevSpec_Analysis.md)
3. [SellerOutreachMVP_ImplementationBacklog_Analysis.md](./SellerOutreachMVP_ImplementationBacklog_Analysis.md)
4. [SellerOutreachMVP_ExecutionRoadmap_Analysis.md](./SellerOutreachMVP_ExecutionRoadmap_Analysis.md)
5. [SellerOutreachMVP_TechArchitecture_Analysis.md](./SellerOutreachMVP_TechArchitecture_Analysis.md)
6. [SellerOutreachMVP_SQLDraft_Analysis.md](./SellerOutreachMVP_SQLDraft_Analysis.md)
7. [SellerOutreachMVP_ScreenApiMatrix_Analysis.md](./SellerOutreachMVP_ScreenApiMatrix_Analysis.md)

## 추천 읽기 순서
1. 방향 이해
   [SellerOutreachMVP_FinalBrief_Analysis.md](./SellerOutreachMVP_FinalBrief_Analysis.md)
   [SellerOutreachMVP_DevSpec_Analysis.md](./SellerOutreachMVP_DevSpec_Analysis.md)
2. 데이터 계약 확인
   [SellerOutreachMVP_DataModel_Analysis.md](./SellerOutreachMVP_DataModel_Analysis.md)
   [SellerOutreachMVP_DDL_Analysis.md](./SellerOutreachMVP_DDL_Analysis.md)
   [SellerOutreachMVP_SQLDraft_Analysis.md](./SellerOutreachMVP_SQLDraft_Analysis.md)
   [SellerOutreachMVP_API_DTO_Analysis.md](./SellerOutreachMVP_API_DTO_Analysis.md)
3. 화면과 흐름 확인
   [SellerOutreachMVP_UIFlow_Analysis.md](./SellerOutreachMVP_UIFlow_Analysis.md)
   [SellerOutreachMVP_Wireframes_Analysis.md](./SellerOutreachMVP_Wireframes_Analysis.md)
   [SellerOutreachMVP_ScreenApiMatrix_Analysis.md](./SellerOutreachMVP_ScreenApiMatrix_Analysis.md)
4. 구현 순서 확인
   [SellerOutreachMVP_BackendRoadmap_Analysis.md](./SellerOutreachMVP_BackendRoadmap_Analysis.md)
   [SellerOutreachMVP_ImplementationBacklog_Analysis.md](./SellerOutreachMVP_ImplementationBacklog_Analysis.md)
   [SellerOutreachMVP_ExecutionRoadmap_Analysis.md](./SellerOutreachMVP_ExecutionRoadmap_Analysis.md)

## 현재 코드 기준 구현 범위
- 설정 도메인: `campaigns`, `sources`, `filters`, `scoring-rule-set`, `review-checklist-template`
- 리드 도메인: 목록, 상세, 등록, 점수 계산
- 검수 도메인: `review-queue`, 검수 상세, 검수 제출
- 아웃리치 도메인: `outreach-queue`, preview, approve, send-email, queue-dm
- CRM 도메인: `crm/board`, replies, activities, move-stage
- 온보딩 도메인: 목록, 상세, 시작, 업데이트
- 운영 도메인: `dashboard`, `audit-log`

## 코드 시작점
- 루트 워크스페이스: `C:\SellerFind\package.json`
- 프론트엔드: `C:\SellerFind\apps\web`
- 백엔드: `C:\SellerFind\apps\api`
- DB 스키마: `C:\SellerFind\packages\db\prisma\schema.prisma`
