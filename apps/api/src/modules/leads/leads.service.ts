import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CreateLeadDto,
  LeadDetailDto,
  LeadListQueryDto,
  LeadScoreDto,
  LeadSummaryDto
} from "./leads.types";

type LeadRecord = Omit<LeadDetailDto, "score" | "totalScore" | "scoreGrade">;

@Injectable()
export class LeadsService {
  private nextLeadId = 4;
  private nextContactId = 5;
  private nextPostId = 5;

  private readonly leads: LeadRecord[] = [
    {
      id: 1,
      campaignId: 1,
      platform: "INSTAGRAM",
      handle: "@kbeauty_store_lab",
      displayName: "KBeauty Store Lab",
      category: "K-Beauty",
      followerCount: 12200,
      postCount: 168,
      leadStatus: "REVIEW_READY",
      crmStage: "CONTACTED",
      riskFlags: ["민감 성분 검토 필요"],
      bio: "K-beauty 셀렉트샵과 신제품 리뷰를 함께 운영하는 스토어",
      reviewNotes: "프로필 링크와 공개 이메일이 있어 검수 우선순위가 높다.",
      contacts: [
        {
          id: 1,
          contactType: "EMAIL",
          contactValue: "hello@kbeautylab.example",
          isPrimary: true
        },
        {
          id: 2,
          contactType: "INSTAGRAM_DM",
          contactValue: "@kbeauty_store_lab",
          isPrimary: false
        }
      ],
      posts: [
        {
          id: 1,
          postUrl: "https://instagram.com/p/sample1",
          caption: "신제품 런칭 소개 포스트",
          postedAt: "2026-03-15T10:00:00Z"
        },
        {
          id: 2,
          postUrl: "https://instagram.com/p/sample2",
          caption: "베스트셀러 상품 큐레이션",
          postedAt: "2026-03-12T10:00:00Z"
        }
      ]
    },
    {
      id: 2,
      campaignId: 1,
      platform: "INSTAGRAM",
      handle: "@seoul_skin_archive",
      displayName: "Seoul Skin Archive",
      category: "K-Beauty",
      followerCount: 4100,
      postCount: 74,
      leadStatus: "NEW",
      crmStage: "CONTACTED",
      riskFlags: [],
      bio: "K-뷰티 성분 큐레이션과 리뷰 콘텐츠 운영",
      reviewNotes: "콘텐츠 품질은 좋지만 판매 채널 명확성은 추가 확인 필요",
      contacts: [
        {
          id: 3,
          contactType: "INSTAGRAM_DM",
          contactValue: "@seoul_skin_archive",
          isPrimary: true
        }
      ],
      posts: [
        {
          id: 3,
          postUrl: "https://instagram.com/p/sample3",
          caption: "성분 비교 요약 카드뉴스",
          postedAt: "2026-03-16T08:30:00Z"
        }
      ]
    },
    {
      id: 3,
      campaignId: 1,
      platform: "TIKTOK",
      handle: "@kglow_finds",
      displayName: "KGlow Finds",
      category: "Beauty Accessories",
      followerCount: 28000,
      postCount: 220,
      leadStatus: "APPROVED",
      crmStage: "REPLIED",
      riskFlags: ["DM보다 이메일 우선 권장"],
      bio: "뷰티 소도구와 액세서리 하울 중심의 숏폼 채널",
      reviewNotes: "브랜드 톤이 명확해서 개인화 메시지 작성이 쉬움",
      contacts: [
        {
          id: 4,
          contactType: "EMAIL",
          contactValue: "partnerships@kglowfinds.example",
          isPrimary: true
        }
      ],
      posts: [
        {
          id: 4,
          postUrl: "https://tiktok.com/@kglow_finds/video/sample4",
          caption: "뷰티 툴 추천 숏폼",
          postedAt: "2026-03-14T12:00:00Z"
        }
      ]
    }
  ];

  findAll(query: LeadListQueryDto): LeadSummaryDto[] {
    return this.leads
      .filter((lead) => {
        if (query.campaignId && lead.campaignId !== Number(query.campaignId)) {
          return false;
        }

        if (query.platform && lead.platform !== query.platform) {
          return false;
        }

        if (query.leadStatus && lead.leadStatus !== query.leadStatus) {
          return false;
        }

        if (query.keyword) {
          const keyword = query.keyword.toLowerCase();
          const haystack = `${lead.handle} ${lead.displayName} ${lead.category ?? ""}`.toLowerCase();
          return haystack.includes(keyword);
        }

        return true;
      })
      .map((lead) => this.toSummary(lead));
  }

  findOne(id: number): LeadDetailDto {
    const lead = this.requireLead(id);
    return this.toDetail(lead);
  }

  create(payload: CreateLeadDto): LeadDetailDto {
    const contactValue = payload.contactValue?.trim();
    const record: LeadRecord = {
      id: this.nextLeadId++,
      campaignId: payload.campaignId,
      platform: payload.platform,
      handle: payload.handle,
      displayName: payload.displayName,
      category: payload.category,
      followerCount: payload.followerCount,
      postCount: payload.postCount,
      leadStatus: "NEW",
      crmStage: "CONTACTED",
      riskFlags: [],
      bio: payload.bio,
      reviewNotes: "신규 등록 리드",
      contacts: contactValue
        ? [
            {
              id: this.nextContactId++,
              contactType: "EMAIL",
              contactValue,
              isPrimary: true
            }
          ]
        : [],
      posts: []
    };

    this.leads.unshift(record);
    return this.toDetail(record);
  }

  recalculateScore(id: number): LeadScoreDto {
    const lead = this.requireLead(id);
    return this.buildScore(lead);
  }

  private requireLead(id: number): LeadRecord {
    const lead = this.leads.find((item) => item.id === id);

    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    return lead;
  }

  private toSummary(lead: LeadRecord): LeadSummaryDto {
    const score = this.buildScore(lead);

    return {
      id: lead.id,
      campaignId: lead.campaignId,
      platform: lead.platform,
      handle: lead.handle,
      displayName: lead.displayName,
      category: lead.category,
      followerCount: lead.followerCount,
      leadStatus: lead.leadStatus,
      crmStage: lead.crmStage,
      totalScore: score.totalScore,
      scoreGrade: score.scoreGrade,
      riskFlags: lead.riskFlags
    };
  }

  private toDetail(lead: LeadRecord): LeadDetailDto {
    return {
      ...this.toSummary(lead),
      bio: lead.bio,
      postCount: lead.postCount,
      reviewNotes: lead.reviewNotes,
      contacts: lead.contacts,
      posts: lead.posts,
      score: this.buildScore(lead)
    };
  }

  private buildScore(lead: LeadRecord): LeadScoreDto {
    const scoreBreakdown: LeadScoreDto["scoreBreakdown"] = [];
    let totalScore = 0;

    if ((lead.followerCount ?? 0) >= 10000) {
      scoreBreakdown.push({
        label: "팔로워 규모",
        scoreDelta: 25,
        reason: "팔로워 수가 1만 명 이상이다"
      });
      totalScore += 25;
    } else if ((lead.followerCount ?? 0) >= 3000) {
      scoreBreakdown.push({
        label: "팔로워 규모",
        scoreDelta: 15,
        reason: "팔로워 수가 3천 명 이상이다"
      });
      totalScore += 15;
    }

    if (lead.contacts.some((item) => item.contactType === "EMAIL")) {
      scoreBreakdown.push({
        label: "공개 이메일",
        scoreDelta: 15,
        reason: "공개 이메일 채널이 존재한다"
      });
      totalScore += 15;
    }

    if ((lead.postCount ?? 0) >= 100) {
      scoreBreakdown.push({
        label: "콘텐츠 활동량",
        scoreDelta: 10,
        reason: "게시물 수가 충분하다"
      });
      totalScore += 10;
    }

    if (lead.riskFlags.length > 0) {
      scoreBreakdown.push({
        label: "위험 신호",
        scoreDelta: -10,
        reason: "검토가 필요한 위험 신호가 존재한다"
      });
      totalScore -= 10;
    }

    const scoreGrade =
      totalScore >= 40 ? "A" : totalScore >= 25 ? "B" : totalScore >= 10 ? "C" : "D";

    return {
      totalScore,
      scoreGrade,
      scoreBreakdown
    };
  }
}
