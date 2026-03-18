"use client";

import type { CSSProperties, ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";

type CampaignSummary = {
  id: number;
  name: string;
  category?: string;
  targetPlatform: string;
  outreachChannelPriority: string;
  status: string;
  description?: string;
  sourceCount: number;
  filterCount: number;
};

type CampaignSource = {
  id: number;
  sourceType: string;
  sourceValue: string;
  notes?: string;
};

type CampaignFilter = {
  id: number;
  filterType: string;
  operator: string;
  filterValue: string;
};

type ScoringRule = {
  id: number;
  ruleName: string;
  scoreDelta: number;
  ruleType: string;
  conditionSummary: string;
};

type ScoringRuleSet = {
  id: number;
  name: string;
  isActive: boolean;
  rules: ScoringRule[];
};

type ReviewChecklistItem = {
  id: number;
  label: string;
  itemType: string;
  isRequired: boolean;
};

type ReviewChecklistTemplate = {
  id: number;
  name: string;
  isActive: boolean;
  items: ReviewChecklistItem[];
};

type CampaignDetail = {
  id: number;
  name: string;
  category?: string;
  targetPlatform: string;
  outreachChannelPriority: string;
  status: string;
  description?: string;
  sources: CampaignSource[];
  filters: CampaignFilter[];
  scoringRuleSet: ScoringRuleSet;
  reviewChecklistTemplate: ReviewChecklistTemplate;
};

type CampaignForm = {
  name: string;
  category: string;
  targetPlatform: string;
  outreachChannelPriority: string;
  status: string;
  description: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const seedCampaignDetail: CampaignDetail = {
  id: 1,
  name: "K-Beauty Instagram Sellers",
  category: "K-Beauty",
  targetPlatform: "INSTAGRAM",
  outreachChannelPriority: "EMAIL",
  status: "ACTIVE",
  description: "공개 판매자 후보를 찾고 이메일 우선으로 검수하는 첫 캠페인",
  sources: [
    {
      id: 1,
      sourceType: "HASHTAG",
      sourceValue: "#kbeautystore",
      notes: "해시태그 기반 탐색"
    },
    {
      id: 2,
      sourceType: "SEED_ACCOUNT",
      sourceValue: "@kbeauty_example",
      notes: "유사 계정 탐색"
    }
  ],
  filters: [
    {
      id: 1,
      filterType: "FOLLOWER_COUNT",
      operator: ">=",
      filterValue: "3000"
    },
    {
      id: 2,
      filterType: "EXCLUDE_CATEGORY",
      operator: "NOT_IN",
      filterValue: "식품,의약품"
    }
  ],
  scoringRuleSet: {
    id: 1,
    name: "Default K-Beauty Score",
    isActive: true,
    rules: [
      {
        id: 1,
        ruleName: "판매 링크 존재",
        scoreDelta: 20,
        ruleType: "PROFILE",
        conditionSummary: "프로필에 쇼핑 링크 또는 자사몰 링크가 있다"
      },
      {
        id: 2,
        ruleName: "이메일 공개",
        scoreDelta: 15,
        ruleType: "CONTACT",
        conditionSummary: "공개 이메일이 확인된다"
      }
    ]
  },
  reviewChecklistTemplate: {
    id: 1,
    name: "Default Review Checklist",
    isActive: true,
    items: [
      {
        id: 1,
        label: "실제 판매 계정으로 보인다",
        itemType: "BOOLEAN",
        isRequired: true
      },
      {
        id: 2,
        label: "공개 연락 채널이 존재한다",
        itemType: "BOOLEAN",
        isRequired: true
      }
    ]
  }
};

const seedCampaigns: CampaignSummary[] = [
  {
    id: seedCampaignDetail.id,
    name: seedCampaignDetail.name,
    category: seedCampaignDetail.category,
    targetPlatform: seedCampaignDetail.targetPlatform,
    outreachChannelPriority: seedCampaignDetail.outreachChannelPriority,
    status: seedCampaignDetail.status,
    description: seedCampaignDetail.description,
    sourceCount: seedCampaignDetail.sources.length,
    filterCount: seedCampaignDetail.filters.length
  }
];

const formSectionStyle: CSSProperties = {
  background: "#111827",
  border: "1px solid #1f2937",
  borderRadius: 16,
  padding: 20
};

const inputStyle: CSSProperties = {
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

function createEmptyCampaignForm(): CampaignForm {
  return {
    name: "",
    category: "",
    targetPlatform: "INSTAGRAM",
    outreachChannelPriority: "EMAIL",
    status: "ACTIVE",
    description: ""
  };
}

export function SettingsClient() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  const [newCampaignForm, setNewCampaignForm] = useState<CampaignForm>(createEmptyCampaignForm());
  const [editCampaignForm, setEditCampaignForm] = useState<CampaignForm>(createEmptyCampaignForm());
  const [sourceForm, setSourceForm] = useState({ sourceType: "HASHTAG", sourceValue: "", notes: "" });
  const [filterForm, setFilterForm] = useState({ filterType: "FOLLOWER_COUNT", operator: ">=", filterValue: "" });
  const [ruleSetDraft, setRuleSetDraft] = useState<ScoringRuleSet>(seedCampaignDetail.scoringRuleSet);
  const [checklistDraft, setChecklistDraft] = useState<ReviewChecklistTemplate>(seedCampaignDetail.reviewChecklistTemplate);
  const [statusMessage, setStatusMessage] = useState("API 연결을 확인하는 중입니다.");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadCampaigns();
  }, []);

  async function loadCampaigns() {
    setIsLoading(true);

    try {
      const nextCampaigns = await request<CampaignSummary[]>("/campaigns");
      setCampaigns(nextCampaigns);
      const nextSelectedId = nextCampaigns[0]?.id ?? null;
      setSelectedCampaignId(nextSelectedId);
      setStatusMessage("API에서 캠페인 설정을 불러왔습니다.");
      if (nextSelectedId) {
        await loadCampaign(nextSelectedId);
      }
    } catch {
      setCampaigns(seedCampaigns);
      setSelectedCampaignId(seedCampaignDetail.id);
      hydrateCampaign(seedCampaignDetail);
      setStatusMessage("API가 아직 실행 중이 아니라 샘플 데이터로 표시 중입니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCampaign(campaignId: number) {
    try {
      const detail = await request<CampaignDetail>(`/campaigns/${campaignId}`);
      hydrateCampaign(detail);
    } catch {
      if (campaignId === seedCampaignDetail.id) {
        hydrateCampaign(seedCampaignDetail);
      }
    }
  }

  function hydrateCampaign(detail: CampaignDetail) {
    setSelectedCampaign(detail);
    setEditCampaignForm({
      name: detail.name,
      category: detail.category ?? "",
      targetPlatform: detail.targetPlatform,
      outreachChannelPriority: detail.outreachChannelPriority,
      status: detail.status,
      description: detail.description ?? ""
    });
    setRuleSetDraft(detail.scoringRuleSet);
    setChecklistDraft(detail.reviewChecklistTemplate);
  }

  async function handleCreateCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const created = await request<CampaignDetail>("/campaigns", {
        method: "POST",
        body: JSON.stringify(newCampaignForm)
      });

      const summary: CampaignSummary = {
        id: created.id,
        name: created.name,
        category: created.category,
        targetPlatform: created.targetPlatform,
        outreachChannelPriority: created.outreachChannelPriority,
        status: created.status,
        description: created.description,
        sourceCount: created.sources.length,
        filterCount: created.filters.length
      };

      setCampaigns((prev) => [...prev, summary]);
      setSelectedCampaignId(created.id);
      hydrateCampaign(created);
      setNewCampaignForm(createEmptyCampaignForm());
      setStatusMessage("새 캠페인을 생성했습니다.");
    } catch {
      setStatusMessage("API가 준비되면 새 캠페인 생성이 가능합니다.");
    }
  }

  async function handleUpdateCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCampaignId) {
      return;
    }

    try {
      const updated = await request<CampaignDetail>(`/campaigns/${selectedCampaignId}`, {
        method: "PATCH",
        body: JSON.stringify(editCampaignForm)
      });

      setCampaigns((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                name: updated.name,
                category: updated.category,
                targetPlatform: updated.targetPlatform,
                outreachChannelPriority: updated.outreachChannelPriority,
                status: updated.status,
                description: updated.description
              }
            : item
        )
      );
      hydrateCampaign(updated);
      setStatusMessage("캠페인 기본 정보를 저장했습니다.");
    } catch {
      setStatusMessage("API가 준비되면 캠페인 수정이 가능합니다.");
    }
  }

  async function handleAddSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCampaignId) {
      return;
    }

    try {
      await request(`/campaigns/${selectedCampaignId}/sources`, {
        method: "POST",
        body: JSON.stringify(sourceForm)
      });
      await loadCampaign(selectedCampaignId);
      await refreshSummaries();
      setSourceForm({ sourceType: "HASHTAG", sourceValue: "", notes: "" });
      setStatusMessage("후보 소스를 추가했습니다.");
    } catch {
      setStatusMessage("API가 준비되면 후보 소스 추가가 가능합니다.");
    }
  }

  async function handleAddFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCampaignId) {
      return;
    }

    try {
      await request(`/campaigns/${selectedCampaignId}/filters`, {
        method: "POST",
        body: JSON.stringify(filterForm)
      });
      await loadCampaign(selectedCampaignId);
      await refreshSummaries();
      setFilterForm({ filterType: "FOLLOWER_COUNT", operator: ">=", filterValue: "" });
      setStatusMessage("필터를 추가했습니다.");
    } catch {
      setStatusMessage("API가 준비되면 필터 추가가 가능합니다.");
    }
  }

  async function handleSaveRules() {
    if (!selectedCampaignId) {
      return;
    }

    try {
      const saved = await request<ScoringRuleSet>(`/campaigns/${selectedCampaignId}/scoring-rule-set`, {
        method: "PUT",
        body: JSON.stringify(ruleSetDraft)
      });
      setRuleSetDraft(saved);
      await loadCampaign(selectedCampaignId);
      setStatusMessage("점수 규칙 세트를 저장했습니다.");
    } catch {
      setStatusMessage("API가 준비되면 점수 규칙 저장이 가능합니다.");
    }
  }

  async function handleSaveChecklist() {
    if (!selectedCampaignId) {
      return;
    }

    try {
      const saved = await request<ReviewChecklistTemplate>(
        `/campaigns/${selectedCampaignId}/review-checklist-template`,
        {
          method: "PUT",
          body: JSON.stringify(checklistDraft)
        }
      );
      setChecklistDraft(saved);
      await loadCampaign(selectedCampaignId);
      setStatusMessage("검수 체크리스트를 저장했습니다.");
    } catch {
      setStatusMessage("API가 준비되면 체크리스트 저장이 가능합니다.");
    }
  }

  async function refreshSummaries() {
    try {
      const nextCampaigns = await request<CampaignSummary[]>("/campaigns");
      setCampaigns(nextCampaigns);
    } catch {
      // 샘플 데이터 모드에서는 요약 갱신을 건너뛴다.
    }
  }

  return (
    <main style={{ padding: 32, display: "grid", gap: 20 }}>
      <section style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>설정 페이지</h1>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            캠페인, 후보 발굴 기준, 점수표, 검수 체크리스트를 한 화면에서 다룹니다.
          </p>
        </div>
        <div style={{ color: "#7dd3fc" }}>{isLoading ? "불러오는 중..." : statusMessage}</div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
        <aside style={formSectionStyle}>
          <h2 style={{ marginTop: 0 }}>캠페인 목록</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() => {
                  setSelectedCampaignId(campaign.id);
                  void loadCampaign(campaign.id);
                }}
                style={{
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 12,
                  border:
                    selectedCampaignId === campaign.id
                      ? "1px solid #38bdf8"
                      : "1px solid #1f2937",
                  background:
                    selectedCampaignId === campaign.id ? "#082f49" : "#020617",
                  color: "#e2e8f0",
                  cursor: "pointer"
                }}
              >
                <div style={{ fontWeight: 700 }}>{campaign.name}</div>
                <div style={{ color: "#94a3b8", fontSize: 14 }}>
                  {campaign.targetPlatform} · {campaign.outreachChannelPriority}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>
                  소스 {campaign.sourceCount}개 · 필터 {campaign.filterCount}개
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section style={{ display: "grid", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <form onSubmit={handleCreateCampaign} style={formSectionStyle}>
              <h2 style={{ marginTop: 0 }}>새 캠페인 생성</h2>
              <Field label="캠페인 이름">
                <input
                  value={newCampaignForm.name}
                  onChange={(event) =>
                    setNewCampaignForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="카테고리">
                <input
                  value={newCampaignForm.category}
                  onChange={(event) =>
                    setNewCampaignForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="플랫폼">
                <select
                  value={newCampaignForm.targetPlatform}
                  onChange={(event) =>
                    setNewCampaignForm((prev) => ({ ...prev, targetPlatform: event.target.value }))
                  }
                  style={inputStyle}
                >
                  <option value="INSTAGRAM">INSTAGRAM</option>
                  <option value="TIKTOK">TIKTOK</option>
                </select>
              </Field>
              <Field label="아웃리치 우선 채널">
                <select
                  value={newCampaignForm.outreachChannelPriority}
                  onChange={(event) =>
                    setNewCampaignForm((prev) => ({ ...prev, outreachChannelPriority: event.target.value }))
                  }
                  style={inputStyle}
                >
                  <option value="EMAIL">EMAIL</option>
                  <option value="DM">DM</option>
                </select>
              </Field>
              <Field label="설명">
                <textarea
                  value={newCampaignForm.description}
                  onChange={(event) =>
                    setNewCampaignForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  style={{ ...inputStyle, minHeight: 96 }}
                />
              </Field>
              <button type="submit" style={primaryButtonStyle}>새 캠페인 추가</button>
            </form>

            <form onSubmit={handleUpdateCampaign} style={formSectionStyle}>
              <h2 style={{ marginTop: 0 }}>선택 캠페인 수정</h2>
              <p style={{ color: "#94a3b8" }}>
                선택된 캠페인: {selectedCampaign?.name ?? "없음"}
              </p>
              <Field label="캠페인 이름">
                <input
                  value={editCampaignForm.name}
                  onChange={(event) =>
                    setEditCampaignForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="카테고리">
                <input
                  value={editCampaignForm.category}
                  onChange={(event) =>
                    setEditCampaignForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="상태">
                <select
                  value={editCampaignForm.status}
                  onChange={(event) =>
                    setEditCampaignForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                  style={inputStyle}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </Field>
              <Field label="설명">
                <textarea
                  value={editCampaignForm.description}
                  onChange={(event) =>
                    setEditCampaignForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  style={{ ...inputStyle, minHeight: 96 }}
                />
              </Field>
              <button type="submit" style={primaryButtonStyle} disabled={!selectedCampaignId}>기본 정보 저장</button>
            </form>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <section style={formSectionStyle}>
              <h2 style={{ marginTop: 0 }}>후보 소스</h2>
              <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                {selectedCampaign?.sources.map((source) => (
                  <div key={source.id} style={itemCardStyle}>
                    <strong>{source.sourceType}</strong>
                    <div>{source.sourceValue}</div>
                    <div style={{ color: "#94a3b8", fontSize: 13 }}>{source.notes}</div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddSource} style={{ display: "grid", gap: 10 }}>
                <select
                  value={sourceForm.sourceType}
                  onChange={(event) => setSourceForm((prev) => ({ ...prev, sourceType: event.target.value }))}
                  style={inputStyle}
                >
                  <option value="HASHTAG">HASHTAG</option>
                  <option value="KEYWORD">KEYWORD</option>
                  <option value="SEED_ACCOUNT">SEED_ACCOUNT</option>
                </select>
                <input
                  value={sourceForm.sourceValue}
                  onChange={(event) => setSourceForm((prev) => ({ ...prev, sourceValue: event.target.value }))}
                  placeholder="예: #kbeautystore"
                  style={inputStyle}
                />
                <input
                  value={sourceForm.notes}
                  onChange={(event) => setSourceForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="메모"
                  style={inputStyle}
                />
                <button type="submit" style={secondaryButtonStyle} disabled={!selectedCampaignId}>소스 추가</button>
              </form>
            </section>

            <section style={formSectionStyle}>
              <h2 style={{ marginTop: 0 }}>필터</h2>
              <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                {selectedCampaign?.filters.map((filter) => (
                  <div key={filter.id} style={itemCardStyle}>
                    <strong>{filter.filterType}</strong>
                    <div>
                      {filter.operator} {filter.filterValue}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddFilter} style={{ display: "grid", gap: 10 }}>
                <input
                  value={filterForm.filterType}
                  onChange={(event) => setFilterForm((prev) => ({ ...prev, filterType: event.target.value }))}
                  placeholder="예: FOLLOWER_COUNT"
                  style={inputStyle}
                />
                <input
                  value={filterForm.operator}
                  onChange={(event) => setFilterForm((prev) => ({ ...prev, operator: event.target.value }))}
                  placeholder="예: >="
                  style={inputStyle}
                />
                <input
                  value={filterForm.filterValue}
                  onChange={(event) => setFilterForm((prev) => ({ ...prev, filterValue: event.target.value }))}
                  placeholder="예: 3000"
                  style={inputStyle}
                />
                <button type="submit" style={secondaryButtonStyle} disabled={!selectedCampaignId}>필터 추가</button>
              </form>
            </section>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <section style={formSectionStyle}>
              <h2 style={{ marginTop: 0 }}>점수 규칙 세트</h2>
              <Field label="세트 이름">
                <input
                  value={ruleSetDraft.name}
                  onChange={(event) => setRuleSetDraft((prev) => ({ ...prev, name: event.target.value }))}
                  style={inputStyle}
                />
              </Field>
              <div style={{ display: "grid", gap: 10 }}>
                {ruleSetDraft.rules.map((rule, index) => (
                  <div key={rule.id ?? index} style={itemCardStyle}>
                    <input
                      value={rule.ruleName}
                      onChange={(event) =>
                        setRuleSetDraft((prev) => ({
                          ...prev,
                          rules: prev.rules.map((item) =>
                            item.id === rule.id ? { ...item, ruleName: event.target.value } : item
                          )
                        }))
                      }
                      style={inputStyle}
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, marginTop: 10 }}>
                      <input
                        type="number"
                        value={rule.scoreDelta}
                        onChange={(event) =>
                          setRuleSetDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((item) =>
                              item.id === rule.id
                                ? { ...item, scoreDelta: Number(event.target.value) }
                                : item
                            )
                          }))
                        }
                        style={inputStyle}
                      />
                      <input
                        value={rule.ruleType}
                        onChange={(event) =>
                          setRuleSetDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((item) =>
                              item.id === rule.id ? { ...item, ruleType: event.target.value } : item
                            )
                          }))
                        }
                        style={inputStyle}
                      />
                    </div>
                    <textarea
                      value={rule.conditionSummary}
                      onChange={(event) =>
                        setRuleSetDraft((prev) => ({
                          ...prev,
                          rules: prev.rules.map((item) =>
                            item.id === rule.id
                              ? { ...item, conditionSummary: event.target.value }
                              : item
                          )
                        }))
                      }
                      style={{ ...inputStyle, minHeight: 72, marginTop: 10 }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() =>
                    setRuleSetDraft((prev) => ({
                      ...prev,
                      rules: [
                        ...prev.rules,
                        {
                          id: Date.now(),
                          ruleName: "새 규칙",
                          scoreDelta: 0,
                          ruleType: "PROFILE",
                          conditionSummary: "조건을 입력하세요"
                        }
                      ]
                    }))
                  }
                >
                  규칙 추가
                </button>
                <button type="button" style={primaryButtonStyle} onClick={handleSaveRules} disabled={!selectedCampaignId}>
                  규칙 저장
                </button>
              </div>
            </section>

            <section style={formSectionStyle}>
              <h2 style={{ marginTop: 0 }}>검수 체크리스트</h2>
              <Field label="템플릿 이름">
                <input
                  value={checklistDraft.name}
                  onChange={(event) => setChecklistDraft((prev) => ({ ...prev, name: event.target.value }))}
                  style={inputStyle}
                />
              </Field>
              <div style={{ display: "grid", gap: 10 }}>
                {checklistDraft.items.map((item, index) => (
                  <div key={item.id ?? index} style={itemCardStyle}>
                    <input
                      value={item.label}
                      onChange={(event) =>
                        setChecklistDraft((prev) => ({
                          ...prev,
                          items: prev.items.map((current) =>
                            current.id === item.id ? { ...current, label: event.target.value } : current
                          )
                        }))
                      }
                      style={inputStyle}
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                      <input
                        value={item.itemType}
                        onChange={(event) =>
                          setChecklistDraft((prev) => ({
                            ...prev,
                            items: prev.items.map((current) =>
                              current.id === item.id ? { ...current, itemType: event.target.value } : current
                            )
                          }))
                        }
                        style={inputStyle}
                      />
                      <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1" }}>
                        <input
                          type="checkbox"
                          checked={item.isRequired}
                          onChange={(event) =>
                            setChecklistDraft((prev) => ({
                              ...prev,
                              items: prev.items.map((current) =>
                                current.id === item.id
                                  ? { ...current, isRequired: event.target.checked }
                                  : current
                              )
                            }))
                          }
                        />
                        필수 항목
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() =>
                    setChecklistDraft((prev) => ({
                      ...prev,
                      items: [
                        ...prev.items,
                        {
                          id: Date.now(),
                          label: "새 검수 질문",
                          itemType: "BOOLEAN",
                          isRequired: true
                        }
                      ]
                    }))
                  }
                >
                  항목 추가
                </button>
                <button type="button" style={primaryButtonStyle} onClick={handleSaveChecklist} disabled={!selectedCampaignId}>
                  체크리스트 저장
                </button>
              </div>
            </section>
          </div>
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

const itemCardStyle: CSSProperties = {
  background: "#020617",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: 12
};

const primaryButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#0ea5e9",
  color: "#082f49",
  fontWeight: 700,
  cursor: "pointer"
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#111827",
  color: "#e2e8f0",
  fontWeight: 700,
  cursor: "pointer"
};
