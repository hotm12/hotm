"use client";

import type { ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";

type LeadSummary = {
  id: number;
  campaignId: number;
  platform: string;
  handle: string;
  displayName: string;
  category?: string;
  followerCount?: number;
  leadStatus: string;
  crmStage?: string;
  totalScore: number;
  scoreGrade: string;
  riskFlags: string[];
};

type LeadContact = {
  id: number;
  contactType: string;
  contactValue: string;
  isPrimary: boolean;
};

type LeadPost = {
  id: number;
  postUrl: string;
  caption: string;
  postedAt: string;
};

type LeadScore = {
  totalScore: number;
  scoreGrade: string;
  scoreBreakdown: Array<{
    label: string;
    scoreDelta: number;
    reason: string;
  }>;
};

type LeadDetail = LeadSummary & {
  bio?: string;
  postCount?: number;
  reviewNotes?: string;
  contacts: LeadContact[];
  posts: LeadPost[];
  score: LeadScore;
};

type LeadFilters = {
  platform: string;
  leadStatus: string;
  keyword: string;
};

type CreateLeadForm = {
  campaignId: string;
  platform: string;
  handle: string;
  displayName: string;
  category: string;
  followerCount: string;
  postCount: string;
  bio: string;
  contactValue: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const seedDetails: LeadDetail[] = [
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
    totalScore: 40,
    scoreGrade: "A",
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
      }
    ],
    score: {
      totalScore: 40,
      scoreGrade: "A",
      scoreBreakdown: [
        {
          label: "팔로워 규모",
          scoreDelta: 25,
          reason: "팔로워 수가 1만 명 이상이다"
        },
        {
          label: "공개 이메일",
          scoreDelta: 15,
          reason: "공개 이메일 채널이 존재한다"
        }
      ]
    }
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
    totalScore: 15,
    scoreGrade: "C",
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
    posts: [],
    score: {
      totalScore: 15,
      scoreGrade: "C",
      scoreBreakdown: [
        {
          label: "팔로워 규모",
          scoreDelta: 15,
          reason: "팔로워 수가 3천 명 이상이다"
        }
      ]
    }
  }
];

const formSectionStyle = {
  background: "#111827",
  border: "1px solid #1f2937",
  borderRadius: 16,
  padding: 20
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#020617",
  color: "#e2e8f0"
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

function createEmptyLeadForm(): CreateLeadForm {
  return {
    campaignId: "1",
    platform: "INSTAGRAM",
    handle: "",
    displayName: "",
    category: "",
    followerCount: "",
    postCount: "",
    bio: "",
    contactValue: ""
  };
}

export function LeadsClient() {
  const [filters, setFilters] = useState<LeadFilters>({
    platform: "",
    leadStatus: "",
    keyword: ""
  });
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [createLeadForm, setCreateLeadForm] = useState<CreateLeadForm>(
    createEmptyLeadForm()
  );
  const [statusMessage, setStatusMessage] = useState("리드 데이터를 불러오는 중입니다.");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadLeads();
  }, []);

  async function loadLeads(nextFilters: LeadFilters = filters) {
    setIsLoading(true);

    try {
      const query = new URLSearchParams();
      if (nextFilters.platform) {
        query.set("platform", nextFilters.platform);
      }
      if (nextFilters.leadStatus) {
        query.set("leadStatus", nextFilters.leadStatus);
      }
      if (nextFilters.keyword) {
        query.set("keyword", nextFilters.keyword);
      }

      const list = await request<LeadSummary[]>(
        `/leads${query.toString() ? `?${query.toString()}` : ""}`
      );
      setLeads(list);
      const nextLeadId = list[0]?.id ?? null;
      setSelectedLeadId(nextLeadId);
      if (nextLeadId) {
        await loadLead(nextLeadId);
      } else {
        setSelectedLead(null);
      }
      setStatusMessage("API에서 리드 목록을 불러왔습니다.");
    } catch {
      const fallbackList = seedDetails.map(toSummary);
      setLeads(fallbackList);
      setSelectedLeadId(fallbackList[0]?.id ?? null);
      setSelectedLead(seedDetails[0] ?? null);
      setStatusMessage("API가 아직 실행 중이 아니라 샘플 리드로 표시 중입니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadLead(leadId: number) {
    try {
      const detail = await request<LeadDetail>(`/leads/${leadId}`);
      setSelectedLead(detail);
    } catch {
      setSelectedLead(seedDetails.find((item) => item.id === leadId) ?? null);
    }
  }

  async function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadLeads(filters);
  }

  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const created = await request<LeadDetail>("/leads", {
        method: "POST",
        body: JSON.stringify({
          campaignId: Number(createLeadForm.campaignId),
          platform: createLeadForm.platform,
          handle: createLeadForm.handle,
          displayName: createLeadForm.displayName,
          category: createLeadForm.category || undefined,
          followerCount: createLeadForm.followerCount
            ? Number(createLeadForm.followerCount)
            : undefined,
          postCount: createLeadForm.postCount
            ? Number(createLeadForm.postCount)
            : undefined,
          bio: createLeadForm.bio || undefined,
          contactValue: createLeadForm.contactValue || undefined
        })
      });

      const summary = toSummary(created);
      setLeads((prev) => [summary, ...prev]);
      setSelectedLeadId(created.id);
      setSelectedLead(created);
      setCreateLeadForm(createEmptyLeadForm());
      setStatusMessage("새 리드를 등록했습니다.");
    } catch {
      setStatusMessage("API가 준비되면 새 리드 등록이 가능합니다.");
    }
  }

  async function handleRecalculateScore() {
    if (!selectedLeadId) {
      return;
    }

    try {
      const score = await request<LeadScore>(
        `/leads/${selectedLeadId}/recalculate-score`,
        {
          method: "POST"
        }
      );
      setSelectedLead((prev) =>
        prev
          ? {
              ...prev,
              totalScore: score.totalScore,
              scoreGrade: score.scoreGrade,
              score
            }
          : prev
      );
      setLeads((prev) =>
        prev.map((item) =>
          item.id === selectedLeadId
            ? {
                ...item,
                totalScore: score.totalScore,
                scoreGrade: score.scoreGrade
              }
            : item
        )
      );
      setStatusMessage("선택 리드의 점수를 재계산했습니다.");
    } catch {
      setStatusMessage("API가 준비되면 점수 재계산이 가능합니다.");
    }
  }

  return (
    <main style={{ padding: 32, display: "grid", gap: 20 }}>
      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>리드 리스트</h1>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            필터링, 빠른 등록, 상세 보기, 점수 재계산까지 한 화면에서 시작합니다.
          </p>
        </div>
        <div style={{ color: "#7dd3fc" }}>
          {isLoading ? "불러오는 중..." : statusMessage}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr 1fr",
          gap: 20,
          alignItems: "start"
        }}
      >
        <aside style={{ display: "grid", gap: 20 }}>
          <form onSubmit={handleApplyFilters} style={formSectionStyle}>
            <h2 style={{ marginTop: 0 }}>필터</h2>
            <Field label="플랫폼">
              <select
                value={filters.platform}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    platform: event.target.value
                  }))
                }
                style={inputStyle}
              >
                <option value="">전체</option>
                <option value="INSTAGRAM">INSTAGRAM</option>
                <option value="TIKTOK">TIKTOK</option>
              </select>
            </Field>
            <Field label="리드 상태">
              <select
                value={filters.leadStatus}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    leadStatus: event.target.value
                  }))
                }
                style={inputStyle}
              >
                <option value="">전체</option>
                <option value="NEW">NEW</option>
                <option value="REVIEW_READY">REVIEW_READY</option>
                <option value="APPROVED">APPROVED</option>
                <option value="ON_HOLD">ON_HOLD</option>
              </select>
            </Field>
            <Field label="키워드">
              <input
                value={filters.keyword}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    keyword: event.target.value
                  }))
                }
                placeholder="핸들, 이름, 카테고리"
                style={inputStyle}
              />
            </Field>
            <button type="submit" style={primaryButtonStyle}>
              필터 적용
            </button>
          </form>

          <form onSubmit={handleCreateLead} style={formSectionStyle}>
            <h2 style={{ marginTop: 0 }}>빠른 리드 등록</h2>
            <Field label="핸들">
              <input
                value={createLeadForm.handle}
                onChange={(event) =>
                  setCreateLeadForm((prev) => ({
                    ...prev,
                    handle: event.target.value
                  }))
                }
                placeholder="@brand_handle"
                style={inputStyle}
              />
            </Field>
            <Field label="표시 이름">
              <input
                value={createLeadForm.displayName}
                onChange={(event) =>
                  setCreateLeadForm((prev) => ({
                    ...prev,
                    displayName: event.target.value
                  }))
                }
                placeholder="브랜드명"
                style={inputStyle}
              />
            </Field>
            <Field label="카테고리">
              <input
                value={createLeadForm.category}
                onChange={(event) =>
                  setCreateLeadForm((prev) => ({
                    ...prev,
                    category: event.target.value
                  }))
                }
                style={inputStyle}
              />
            </Field>
            <Field label="팔로워 수">
              <input
                value={createLeadForm.followerCount}
                onChange={(event) =>
                  setCreateLeadForm((prev) => ({
                    ...prev,
                    followerCount: event.target.value
                  }))
                }
                type="number"
                style={inputStyle}
              />
            </Field>
            <Field label="공개 이메일">
              <input
                value={createLeadForm.contactValue}
                onChange={(event) =>
                  setCreateLeadForm((prev) => ({
                    ...prev,
                    contactValue: event.target.value
                  }))
                }
                placeholder="contact@example.com"
                style={inputStyle}
              />
            </Field>
            <button type="submit" style={secondaryButtonStyle}>
              리드 등록
            </button>
          </form>
        </aside>

        <section style={formSectionStyle}>
          <h2 style={{ marginTop: 0 }}>리드 목록</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {leads.map((lead) => (
              <button
                key={lead.id}
                onClick={() => {
                  setSelectedLeadId(lead.id);
                  void loadLead(lead.id);
                }}
                style={{
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 12,
                  border:
                    selectedLeadId === lead.id
                      ? "1px solid #38bdf8"
                      : "1px solid #1f2937",
                  background:
                    selectedLeadId === lead.id ? "#082f49" : "#020617",
                  color: "#e2e8f0",
                  cursor: "pointer"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12
                  }}
                >
                  <strong>{lead.displayName}</strong>
                  <span style={scoreBadgeStyle}>{lead.totalScore}</span>
                </div>
                <div style={{ color: "#94a3b8", marginTop: 4 }}>
                  {lead.handle} · {lead.platform}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 10,
                    flexWrap: "wrap"
                  }}
                >
                  <Tag>{lead.leadStatus}</Tag>
                  <Tag>{lead.scoreGrade}</Tag>
                  {lead.category ? <Tag>{lead.category}</Tag> : null}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section style={formSectionStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <h2 style={{ marginTop: 0 }}>리드 상세</h2>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={handleRecalculateScore}
              disabled={!selectedLeadId}
            >
              점수 재계산
            </button>
          </div>

          {selectedLead ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>{selectedLead.displayName}</h3>
                <div style={{ color: "#94a3b8" }}>
                  {selectedLead.handle} · {selectedLead.platform} ·{" "}
                  {selectedLead.followerCount ?? 0} followers
                </div>
              </div>

              <div style={itemCardStyle}>
                <strong>점수</strong>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
                  {selectedLead.score.totalScore}
                </div>
                <div style={{ color: "#7dd3fc", marginTop: 4 }}>
                  Grade {selectedLead.score.scoreGrade}
                </div>
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                  {selectedLead.score.scoreBreakdown.map((item) => (
                    <div key={item.label} style={subtleCardStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <strong>{item.label}</strong>
                        <span>{item.scoreDelta > 0 ? `+${item.scoreDelta}` : item.scoreDelta}</span>
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 4 }}>
                        {item.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={itemCardStyle}>
                <strong>연락처</strong>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {selectedLead.contacts.map((contact) => (
                    <div key={contact.id} style={subtleCardStyle}>
                      <div>{contact.contactType}</div>
                      <div style={{ color: "#94a3b8" }}>{contact.contactValue}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={itemCardStyle}>
                <strong>리뷰 메모</strong>
                <p style={{ color: "#cbd5e1", marginBottom: 0 }}>
                  {selectedLead.reviewNotes ?? "아직 메모가 없습니다."}
                </p>
              </div>

              <div style={itemCardStyle}>
                <strong>최근 게시물</strong>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {selectedLead.posts.length > 0 ? (
                    selectedLead.posts.map((post) => (
                      <a
                        key={post.id}
                        href={post.postUrl}
                        style={{
                          ...subtleCardStyle,
                          color: "#e2e8f0",
                          textDecoration: "none"
                        }}
                      >
                        <div>{post.caption}</div>
                        <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
                          {new Date(post.postedAt).toLocaleString("ko-KR")}
                        </div>
                      </a>
                    ))
                  ) : (
                    <div style={{ color: "#94a3b8", marginTop: 10 }}>
                      아직 저장된 게시물이 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: "#94a3b8" }}>선택된 리드가 없습니다.</p>
          )}
        </section>
      </section>
    </main>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 8, marginBottom: 14 }}>
      <span style={{ color: "#cbd5e1", fontSize: 14 }}>{props.label}</span>
      {props.children}
    </label>
  );
}

function Tag(props: { children: ReactNode }) {
  return (
    <span
      style={{
        padding: "4px 8px",
        borderRadius: 999,
        background: "#0f172a",
        border: "1px solid #1e293b",
        color: "#cbd5e1",
        fontSize: 12
      }}
    >
      {props.children}
    </span>
  );
}

function toSummary(detail: LeadDetail): LeadSummary {
  return {
    id: detail.id,
    campaignId: detail.campaignId,
    platform: detail.platform,
    handle: detail.handle,
    displayName: detail.displayName,
    category: detail.category,
    followerCount: detail.followerCount,
    leadStatus: detail.leadStatus,
    crmStage: detail.crmStage,
    totalScore: detail.totalScore,
    scoreGrade: detail.scoreGrade,
    riskFlags: detail.riskFlags
  };
}

const itemCardStyle = {
  background: "#020617",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: 14
};

const subtleCardStyle = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 10,
  padding: 10
};

const primaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#0ea5e9",
  color: "#082f49",
  fontWeight: 700,
  cursor: "pointer"
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#111827",
  color: "#e2e8f0",
  fontWeight: 700,
  cursor: "pointer"
};

const scoreBadgeStyle = {
  minWidth: 40,
  textAlign: "center" as const,
  padding: "4px 10px",
  borderRadius: 999,
  background: "#0ea5e9",
  color: "#082f49",
  fontWeight: 800
};
