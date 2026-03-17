# SellerOutreachMVP_API_DTO_Analysis

## 목적
- 화면 기준 request/response DTO를 정리한다.

## 핵심 DTO 묶음
- CampaignCreateRequest / CampaignResponse
- LeadImportRequest / LeadSummaryDto / LeadDetailResponse
- ScoreResponse
- LeadReviewSubmitRequest / LeadReviewSubmitResponse
- OutreachPreviewRequest / OutreachPreviewResponse
- QueueDmRequest / SendEmailRequest
- ReplyImportRequest / ReplyResponse
- MoveCrmStageRequest
- StartOnboardingRequest / UpdateOnboardingRequest / OnboardingResponse

## 공통 원칙
- 날짜는 ISO 8601 문자열
- 성공 응답은 data 래핑 가능
- 실패 응답은 code/message/details 구조
- 상태 필드는 문자열 Enum 사용

## 결론
- DTO를 먼저 고정해두면 백엔드와 프론트엔드가 동시에 작업해도 충돌이 크게 줄어든다.
