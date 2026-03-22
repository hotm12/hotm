"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type OnboardingSummary = {
  leadId: number;
  displayName: string;
  handle: string;
  platform: string;
  onboardingStatus: string;
  nextAction?: string;
  updatedAt?: string;
};

type OnboardingDetail = OnboardingSummary & {
  notes?: string;
  startedAt?: string;
  crmStage?: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const fallbackItems: OnboardingSummary[] = [
  {
    leadId: 3,
    displayName: "KGlow Finds",
    handle: "@kglow_finds",
    platform: "TIKTOK",
    onboardingStatus: "IN_PROGRESS",
    nextAction: "상품 카탈로그 요청",
    updatedAt: "2026-03-18T03:10:00Z"
  }
];

const fallbackDetail: OnboardingDetail = {
  ...fallbackItems[0],
  crmStage: "ONBOARDING",
  notes: "셀러가 긍정 답장을 보냈고, 현재 리스팅 자료를 기다리는 중입니다.",
  startedAt: "2026-03-18T03:00:00Z"
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

export function OnboardingClient() {
  const [items, setItems] = useState<OnboardingSummary[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OnboardingDetail | null>(null);
  const [draftStatus, setDraftStatus] = useState("IN_PROGRESS");
  const [draftNextAction, setDraftNextAction] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState("온보딩 데이터를 불러오는 중입니다.");

  useEffect(() => {
    void loadItems();
  }, []);

  async function loadItems(preferredLeadId?: number | null) {
    try {
      const nextItems = await request<OnboardingSummary[]>("/onboarding");
      setItems(nextItems);
      const nextLeadId =
        nextItems.find((item) => item.leadId === preferredLeadId)?.leadId ?? nextItems[0]?.leadId ?? null;
      setSelectedLeadId(nextLeadId);

      if (nextLeadId) {
        await loadDetail(nextLeadId);
      } else {
        setDetail(null);
      }

      setStatusMessage("API에서 최신 온보딩 데이터를 불러왔습니다.");
    } catch {
      setItems(fallbackItems);
      setSelectedLeadId(fallbackDetail.leadId);
      setDetail(fallbackDetail);
      setDraftStatus(fallbackDetail.onboardingStatus);
      setDraftNextAction(fallbackDetail.nextAction ?? "");
      setDraftNotes(fallbackDetail.notes ?? "");
      setStatusMessage("API 연결이 없어 예시 온보딩 데이터를 표시 중입니다.");
    }
  }

  async function loadDetail(leadId: number) {
    try {
      const nextDetail = await request<OnboardingDetail>(`/onboarding/${leadId}`);
      setDetail(nextDetail);
      setDraftStatus(nextDetail.onboardingStatus);
      setDraftNextAction(nextDetail.nextAction ?? "");
      setDraftNotes(nextDetail.notes ?? "");
    } catch {
      setDetail(fallbackDetail);
      setDraftStatus(fallbackDetail.onboardingStatus);
      setDraftNextAction(fallbackDetail.nextAction ?? "");
      setDraftNotes(fallbackDetail.notes ?? "");
    }
  }

  async function saveOnboarding() {
    if (!selectedLeadId) {
      return;
    }

    try {
      const nextDetail = await request<OnboardingDetail>(`/onboarding/${selectedLeadId}`, {
        method: "PATCH",
        body: JSON.stringify({
          onboardingStatus: draftStatus,
          nextAction: draftNextAction,
          notes: draftNotes
        })
      });

      setDetail(nextDetail);
      await loadItems(selectedLeadId);
      setStatusMessage("온보딩 상태를 업데이트했습니다.");
    } catch {
      setStatusMessage("온보딩 상태 업데이트에 실패했습니다.");
    }
  }

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Onboarding</div>
          <h1 style={titleStyle}>셀러 온보딩 관리</h1>
          <p style={descriptionStyle}>
            CRM 이후 단계에서 필요한 다음 액션과 메모를 관리하고 현재 온보딩 상태를 업데이트할 수 있습니다.
          </p>
        </div>
        <div style={statusStyle}>{statusMessage}</div>
      </section>

      <section style={layoutStyle}>
        <article style={panelStyle}>
          <div style={headerRowStyle}>
            <h2 style={sectionTitleStyle}>온보딩 목록</h2>
            <span style={badgeStyle}>{items.length}건</span>
          </div>
          <div style={listStyle}>
            {items.map((item) => (
              <button
                key={item.leadId}
                type="button"
                onClick={() => {
                  setSelectedLeadId(item.leadId);
                  void loadDetail(item.leadId);
                }}
                style={{
                  ...itemButtonStyle,
                  borderColor: item.leadId === selectedLeadId ? "#38bdf8" : "#1e293b"
                }}
              >
                <div style={rowStyle}>
                  <strong>{item.displayName}</strong>
                  <span style={tagStyle}>{item.onboardingStatus}</span>
                </div>
                <div style={mutedTextStyle}>
                  {item.handle} · {item.platform}
                </div>
                <div style={summaryTextStyle}>{item.nextAction ?? "다음 액션 없음"}</div>
              </button>
            ))}
          </div>
        </article>

        <article style={panelStyle}>
          {detail ? (
            <div style={detailGridStyle}>
              <div style={rowStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>{detail.displayName}</h2>
                  <div style={mutedTextStyle}>
                    {detail.handle} · {detail.platform} · CRM {detail.crmStage ?? "-"}
                  </div>
                </div>
                <span style={tagStyle}>{detail.onboardingStatus}</span>
              </div>

              <div style={statsGridStyle}>
                <div style={statCardStyle}>
                  <span style={mutedTextStyle}>시작 시각</span>
                  <strong>
                    {detail.startedAt ? new Date(detail.startedAt).toLocaleString("ko-KR") : "-"}
                  </strong>
                </div>
                <div style={statCardStyle}>
                  <span style={mutedTextStyle}>업데이트 시각</span>
                  <strong>
                    {detail.updatedAt ? new Date(detail.updatedAt).toLocaleString("ko-KR") : "-"}
                  </strong>
                </div>
              </div>

              <label style={fieldStyle}>
                <span>온보딩 상태</span>
                <select
                  style={inputStyle}
                  value={draftStatus}
                  onChange={(event) => setDraftStatus(event.target.value)}
                >
                  <option value="NOT_STARTED">NOT_STARTED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="WAITING_SELLER">WAITING_SELLER</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </label>

              <label style={fieldStyle}>
                <span>다음 액션</span>
                <input
                  style={inputStyle}
                  value={draftNextAction}
                  onChange={(event) => setDraftNextAction(event.target.value)}
                  placeholder="예: 상품 카탈로그 요청"
                />
              </label>

              <label style={fieldStyle}>
                <span>메모</span>
                <textarea
                  style={textareaStyle}
                  value={draftNotes}
                  onChange={(event) => setDraftNotes(event.target.value)}
                  placeholder="온보딩 진행 메모"
                />
              </label>

              <button type="button" style={primaryButtonStyle} onClick={() => void saveOnboarding()}>
                온보딩 업데이트
              </button>
            </div>
          ) : (
            <div style={emptyStyle}>왼쪽 목록에서 온보딩 대상을 선택해주세요.</div>
          )}
        </article>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 32,
  background:
    "radial-gradient(circle at top right, rgba(236, 72, 153, 0.12), transparent 24%), #020617",
  color: "#e2e8f0",
  display: "grid",
  gap: 20
};

const heroStyle: CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid #1e293b",
  borderRadius: 24,
  padding: 28,
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  alignItems: "flex-end"
};

const eyebrowStyle: CSSProperties = {
  color: "#f472b6",
  fontSize: 13,
  letterSpacing: 1.2,
  textTransform: "uppercase"
};

const titleStyle: CSSProperties = {
  margin: "12px 0 10px",
  fontSize: 36
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  maxWidth: 760,
  lineHeight: 1.7
};

const statusStyle: CSSProperties = {
  color: "#f9a8d4",
  fontSize: 14,
  maxWidth: 320,
  textAlign: "right"
};

const layoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
  gap: 20
};

const panelStyle: CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid #1e293b",
  borderRadius: 22,
  padding: 24,
  display: "grid",
  gap: 16
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center"
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22
};

const badgeStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "#500724",
  color: "#f9a8d4",
  fontSize: 13
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 12
};

const itemButtonStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #1e293b",
  background: "#020617",
  color: "#e2e8f0",
  textAlign: "left",
  cursor: "pointer"
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center"
};

const summaryTextStyle: CSSProperties = {
  color: "#cbd5e1",
  lineHeight: 1.6
};

const mutedTextStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 14
};

const tagStyle: CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  background: "#500724",
  color: "#f9a8d4",
  fontSize: 12
};

const detailGridStyle: CSSProperties = {
  display: "grid",
  gap: 16
};

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12
};

const statCardStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 16,
  padding: 16
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 14,
  color: "#cbd5e1"
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #334155",
  background: "#020617",
  color: "#e2e8f0",
  padding: "11px 12px"
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 180,
  resize: "vertical"
};

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: "12px 16px",
  background: "#f472b6",
  color: "#500724",
  fontWeight: 700,
  cursor: "pointer"
};

const emptyStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px dashed #334155",
  padding: 18,
  color: "#94a3b8",
  textAlign: "center"
};
