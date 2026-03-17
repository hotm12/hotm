# SellerOutreachMVP 문서 인덱스

## 목적
이 폴더는 `SellerOutreachMVP` 개발을 다른 PC나 다른 개발자에게 바로 전달할 수 있도록 정리한 설계 문서 묶음이다.

이 문서 하나만 먼저 읽으면
- 무엇을 만드는지
- 어떤 순서로 읽어야 하는지
- 백엔드와 프론트가 어디서부터 시작하면 되는지
- 사용자 의견이 어디에 반영되는지
를 빠르게 파악할 수 있다.

## 프로젝트 한 줄 요약
틱톡/인스타 공개 판매자 후보를 찾고, 점수화하고, 사람 검수를 거쳐 아웃리치한 뒤, 답장 이후 CRM과 아마존 온보딩으로 연결하는 운영 도구 MVP다.

## 가장 먼저 읽을 문서
1. [SellerOutreachMVP_FinalBrief_Analysis.md](./SellerOutreachMVP_FinalBrief_Analysis.md)
2. [SellerOutreachMVP_DevSpec_Analysis.md](./SellerOutreachMVP_DevSpec_Analysis.md)
3. [SellerOutreachMVP_ImplementationBacklog_Analysis.md](./SellerOutreachMVP_ImplementationBacklog_Analysis.md)

이 3개를 먼저 읽으면 전체 목표, 범위, 우선순위를 빠르게 이해할 수 있다.

## 개발자가 읽는 추천 순서
1. 전체 방향 이해
   - [SellerOutreachMVP_FinalBrief_Analysis.md](./SellerOutreachMVP_FinalBrief_Analysis.md)
   - [SellerOutreachMVP_Analysis.md](./SellerOutreachMVP_Analysis.md)
   - [SellerOutreachMVP_DevSpec_Analysis.md](./SellerOutreachMVP_DevSpec_Analysis.md)
2. 데이터와 계약 확인
   - [SellerOutreachMVP_DataModel_Analysis.md](./SellerOutreachMVP_DataModel_Analysis.md)
   - [SellerOutreachMVP_DDL_Analysis.md](./SellerOutreachMVP_DDL_Analysis.md)
   - [SellerOutreachMVP_API_Analysis.md](./SellerOutreachMVP_API_Analysis.md)
   - [SellerOutreachMVP_API_DTO_Analysis.md](./SellerOutreachMVP_API_DTO_Analysis.md)
3. 화면과 사용자 흐름 확인
   - [SellerOutreachMVP_UIFlow_Analysis.md](./SellerOutreachMVP_UIFlow_Analysis.md)
   - [SellerOutreachMVP_Wireframes_Analysis.md](./SellerOutreachMVP_Wireframes_Analysis.md)
   - [SellerOutreachMVP_OperatorForms_Analysis.md](./SellerOutreachMVP_OperatorForms_Analysis.md)
4. 구현 순서 확인
   - [SellerOutreachMVP_BackendRoadmap_Analysis.md](./SellerOutreachMVP_BackendRoadmap_Analysis.md)
   - [SellerOutreachMVP_FrontendComponents_Analysis.md](./SellerOutreachMVP_FrontendComponents_Analysis.md)
   - [SellerOutreachMVP_FrontendState_Analysis.md](./SellerOutreachMVP_FrontendState_Analysis.md)
   - [SellerOutreachMVP_ImplementationBacklog_Analysis.md](./SellerOutreachMVP_ImplementationBacklog_Analysis.md)
5. 운영 규칙과 사용자 입력 구조 확인
   - [SellerOutreachMVP_ConfigurableRules_Analysis.md](./SellerOutreachMVP_ConfigurableRules_Analysis.md)
   - [SellerOutreachMVP_OperatorManual_Analysis.md](./SellerOutreachMVP_OperatorManual_Analysis.md)
   - [SellerOutreachMVP_DecisionChecklist_Analysis.md](./SellerOutreachMVP_DecisionChecklist_Analysis.md)

## 역할별 참고 문서

### 백엔드 담당
- [SellerOutreachMVP_DevSpec_Analysis.md](./SellerOutreachMVP_DevSpec_Analysis.md)
- [SellerOutreachMVP_DataModel_Analysis.md](./SellerOutreachMVP_DataModel_Analysis.md)
- [SellerOutreachMVP_DDL_Analysis.md](./SellerOutreachMVP_DDL_Analysis.md)
- [SellerOutreachMVP_API_Analysis.md](./SellerOutreachMVP_API_Analysis.md)
- [SellerOutreachMVP_API_DTO_Analysis.md](./SellerOutreachMVP_API_DTO_Analysis.md)
- [SellerOutreachMVP_BackendRoadmap_Analysis.md](./SellerOutreachMVP_BackendRoadmap_Analysis.md)

### 프론트 담당
- [SellerOutreachMVP_UIFlow_Analysis.md](./SellerOutreachMVP_UIFlow_Analysis.md)
- [SellerOutreachMVP_Wireframes_Analysis.md](./SellerOutreachMVP_Wireframes_Analysis.md)
- [SellerOutreachMVP_OperatorForms_Analysis.md](./SellerOutreachMVP_OperatorForms_Analysis.md)
- [SellerOutreachMVP_FrontendComponents_Analysis.md](./SellerOutreachMVP_FrontendComponents_Analysis.md)
- [SellerOutreachMVP_FrontendState_Analysis.md](./SellerOutreachMVP_FrontendState_Analysis.md)

### 기획/운영 담당
- [SellerOutreachMVP_FinalBrief_Analysis.md](./SellerOutreachMVP_FinalBrief_Analysis.md)
- [SellerOutreachMVP_ConfigurableRules_Analysis.md](./SellerOutreachMVP_ConfigurableRules_Analysis.md)
- [SellerOutreachMVP_OperatorManual_Analysis.md](./SellerOutreachMVP_OperatorManual_Analysis.md)
- [SellerOutreachMVP_DecisionChecklist_Analysis.md](./SellerOutreachMVP_DecisionChecklist_Analysis.md)

## 문서별 역할 요약
- `SellerOutreachMVP_Analysis`: 전체 개요
- `SellerOutreachMVP_FinalBrief_Analysis`: 개발 전달용 1장 요약
- `SellerOutreachMVP_DevSpec_Analysis`: MVP 범위와 기능 명세
- `SellerOutreachMVP_DataModel_Analysis`: 엔티티와 상태 모델
- `SellerOutreachMVP_DDL_Analysis`: PostgreSQL 기준 테이블 설계
- `SellerOutreachMVP_API_Analysis`: API 목록과 책임
- `SellerOutreachMVP_API_DTO_Analysis`: request/response 계약
- `SellerOutreachMVP_UIFlow_Analysis`: 사용자 흐름
- `SellerOutreachMVP_Wireframes_Analysis`: 페이지 구조
- `SellerOutreachMVP_ConfigurableRules_Analysis`: 후보 발굴 기준표, 점수표, 체크리스트 설정 구조
- `SellerOutreachMVP_OperatorForms_Analysis`: 운영자가 실제 입력하는 폼 명세
- `SellerOutreachMVP_BackendRoadmap_Analysis`: 백엔드 구현 단계
- `SellerOutreachMVP_FrontendComponents_Analysis`: 프론트 컴포넌트 분해
- `SellerOutreachMVP_FrontendState_Analysis`: 상태관리 설계
- `SellerOutreachMVP_ImplementationBacklog_Analysis`: 우선순위별 개발 백로그
- `SellerOutreachMVP_OperatorManual_Analysis`: 운영 매뉴얼
- `SellerOutreachMVP_DecisionChecklist_Analysis`: 사용자 의사결정 질문 리스트

## 실제 개발 시작 순서 권장안
1. [SellerOutreachMVP_ImplementationBacklog_Analysis.md](./SellerOutreachMVP_ImplementationBacklog_Analysis.md)의 `P0`만 먼저 시작한다.
2. 백엔드는 `DDL -> API -> DTO -> BackendRoadmap` 순서로 구체화한다.
3. 프론트는 `UIFlow -> Wireframes -> OperatorForms -> FrontendComponents -> FrontendState` 순서로 본다.
4. 사용자 의견이 필요한 항목은 [SellerOutreachMVP_DecisionChecklist_Analysis.md](./SellerOutreachMVP_DecisionChecklist_Analysis.md)를 기준으로 확인한다.

## 개발 중 사용자 의견이 들어가는 지점
- 첫 타겟 카테고리
- 점수 규칙 가중치
- 제외 카테고리
- 아웃리치 채널 우선순위
- 메시지 톤
- CRM 단계 이름
- 성공 기준

이 항목들은 개발자가 임의로 확정하지 말고, 사용자 확인 후 반영하는 것이 맞다.

## 전달할 때 함께 말하면 좋은 한 줄
`index.md -> FinalBrief -> DevSpec -> ImplementationBacklog` 순서로 먼저 읽고, 이후 역할별 문서로 나눠서 작업하면 된다.
