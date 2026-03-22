"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  canWriteWithRole,
  loadOperatorProfile,
  type OperatorProfile
} from "../operator-profile";

type OutreachQueueItem = {
  leadId: number;
  displayName: string;
  handle: string;
  platform: string;
  channel: string;
  deliveryStatus: string;
  subject?: string;
  previewText: string;
  approvedAt?: string;
  sentAt?: string;
  safetyChecks: string[];
};

type OutreachPreview = {
  leadId: number;
  displayName: string;
  channel: string;
  subject?: string;
  body: string;
  deliveryStatus: string;
  recommendedAction: string;
  safetyChecks: string[];
  canApprove: boolean;
  canSendEmail: boolean;
  canQueueDm: boolean;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const fallbackQueue: OutreachQueueItem[] = [
  {
    leadId: 3,
    displayName: "KGlow Finds",
    handle: "@kglow_finds",
    platform: "TIKTOK",
    channel: "EMAIL",
    deliveryStatus: "APPROVED",
    subject: "Amazon 입점 제안 안내",
    previewText: "안녕하세요. 아마존 확장 가능성을 함께 검토해보고 싶습니다.",
    approvedAt: "2026-03-18T00:10:00Z",
    safetyChecks: []
  }
];

const fallbackPreview: OutreachPreview = {
  leadId: 3,
  displayName: "KGlow Finds",
  channel: "EMAIL",
  subject: "Amazon 입점 제안 안내",
  body: "안녕하세요. 귀사의 카탈로그 구성이 아마존 확장에 적합해 보여 제안드립니다. 가능하시다면 간단한 소개 미팅을 진행하고 싶습니다.",
  deliveryStatus: "APPROVED",
  safetyChecks: [],
  canApprove: true,
  canSendEmail: true,
  canQueueDm: true,
  recommendedAction: "이메일 검토 후 발송"
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
    let message = `Request failed: ${response.status}`;

    try {
      const errorPayload = (await response.json()) as {
        message?: string | string[];
      };
      const nextMessage = Array.isArray(errorPayload.message)
        ? errorPayload.message.join(", ")
        : errorPayload.message;

      if (nextMessage) {
        message = nextMessage;
      }
    } catch {}

    throw new Error(message);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export function OutreachClient() {
  const [operatorProfile, setOperatorProfile] = useState<OperatorProfile>(loadOperatorProfile());
  const [items, setItems] = useState<OutreachQueueItem[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [preview, setPreview] = useState<OutreachPreview | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [approveConfirmed, setApproveConfirmed] = useState(false);
  const [sendConfirmed, setSendConfirmed] = useState(false);
  const [queueConfirmed, setQueueConfirmed] = useState(false);
  const [statusMessage, setStatusMessage] = useState("아웃리치 큐를 불러오는 중입니다.");

  useEffect(() => {
    void loadQueue();
    setOperatorProfile(loadOperatorProfile());
  }, []);

  async function loadQueue(preferredLeadId?: number | null) {
    try {
      const nextItems = await request<OutreachQueueItem[]>("/outreach-queue");
      setItems(nextItems);
      const nextLeadId =
        nextItems.find((item) => item.leadId === preferredLeadId)?.leadId ?? nextItems[0]?.leadId ?? null;
      setSelectedLeadId(nextLeadId);

      if (nextLeadId) {
        await loadPreview(nextLeadId);
      } else {
        setPreview(null);
      }

      setStatusMessage("API에서 최신 아웃리치 큐를 불러왔습니다.");
    } catch (error) {
      setItems(fallbackQueue);
      setSelectedLeadId(fallbackPreview.leadId);
      setPreview(fallbackPreview);
      setDraftSubject(fallbackPreview.subject ?? "");
      setDraftBody(fallbackPreview.body);
      setStatusMessage("API 연결이 없어 예시 아웃리치 데이터를 표시 중입니다.");
    }
  }

  async function loadPreview(leadId: number) {
    try {
      const nextPreview = await request<OutreachPreview>(`/outreach-queue/${leadId}`);
      setPreview(nextPreview);
      setDraftSubject(nextPreview.subject ?? "");
      setDraftBody(nextPreview.body);
      setApproveConfirmed(false);
      setSendConfirmed(false);
      setQueueConfirmed(false);
    } catch (error) {
      setPreview(fallbackPreview);
      setDraftSubject(fallbackPreview.subject ?? "");
      setDraftBody(fallbackPreview.body);
    }
  }

  async function approveDraft() {
    if (!selectedLeadId) {
      return;
    }

    try {
      const nextPreview = await request<OutreachPreview>(`/outreach-queue/${selectedLeadId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          channel: preview?.channel ?? "EMAIL",
          actor: operatorProfile.name,
          approvalNote,
          confirmed: approveConfirmed
        })
      });

      setPreview(nextPreview);
      setDraftSubject(nextPreview.subject ?? "");
      setDraftBody(nextPreview.body);
      await loadQueue(selectedLeadId);
      setStatusMessage("초안을 승인 상태로 전환했습니다.");
    } catch (error) {
      setStatusMessage("초안 승인에 실패했습니다.");
    }
  }

  async function sendEmail() {
    if (!selectedLeadId) {
      return;
    }

    try {
      const nextPreview = await request<OutreachPreview>(`/outreach-queue/${selectedLeadId}/send-email`, {
        method: "POST",
        body: JSON.stringify({
          subject: draftSubject,
          body: draftBody,
          actor: operatorProfile.name,
          approvalNote,
          confirmed: sendConfirmed
        })
      });

      setPreview(nextPreview);
      setDraftSubject(nextPreview.subject ?? "");
      setDraftBody(nextPreview.body);
      await loadQueue(selectedLeadId);
      setStatusMessage("이메일 발송 상태로 저장했습니다.");
    } catch (error) {
      setStatusMessage("이메일 발송 처리에 실패했습니다.");
    }
  }

  async function queueDm() {
    if (!selectedLeadId) {
      return;
    }

    try {
      const nextPreview = await request<OutreachPreview>(`/outreach-queue/${selectedLeadId}/queue-dm`, {
        method: "POST",
        body: JSON.stringify({
          body: draftBody,
          actor: operatorProfile.name,
          approvalNote,
          confirmed: queueConfirmed
        })
      });

      setPreview(nextPreview);
      setDraftSubject(nextPreview.subject ?? "");
      setDraftBody(nextPreview.body);
      await loadQueue(selectedLeadId);
      setStatusMessage("DM 수동 발송 큐로 등록했습니다.");
    } catch (error) {
      setStatusMessage("DM 큐 등록에 실패했습니다.");
    }
  }

  const currentItem = useMemo(
    () => items.find((item) => item.leadId === selectedLeadId) ?? null,
    [items, selectedLeadId]
  );
  const canWrite = canWriteWithRole(operatorProfile.role);

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Outreach Queue</div>
          <h1 style={titleStyle}>아웃리치 승인과 발송 관리</h1>
          <p style={descriptionStyle}>
            승인 가능한 메시지 초안을 검토하고, 이메일 발송 또는 DM 수동 발송 큐 등록까지 한 화면에서 처리합니다.
          </p>
        </div>
        <div style={statusStyle}>{statusMessage}</div>
      </section>

      <section style={layoutStyle}>
        <article style={panelStyle}>
          <div style={headerRowStyle}>
            <h2 style={sectionTitleStyle}>발송 대기 목록</h2>
            <span style={badgeStyle}>{items.length}건</span>
          </div>
          <div style={listStyle}>
            {items.map((item) => (
              <button
                key={item.leadId}
                type="button"
                onClick={() => {
                  setSelectedLeadId(item.leadId);
                  void loadPreview(item.leadId);
                }}
                style={{
                  ...itemButtonStyle,
                  borderColor: item.leadId === selectedLeadId ? "#38bdf8" : "#1e293b"
                }}
              >
                <div style={rowStyle}>
                  <strong>{item.displayName}</strong>
                  <span style={tagStyle}>{item.deliveryStatus}</span>
                </div>
                <div style={mutedTextStyle}>
                  {item.handle} · {item.platform} · {item.channel}
                </div>
                <div style={previewTextStyle}>{item.previewText}</div>
                {item.safetyChecks.length ? (
                  <div style={warningListStyle}>
                    {item.safetyChecks.map((warning) => (
                      <div key={warning} style={warningTagStyle}>{warning}</div>
                    ))}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </article>

        <article style={panelStyle}>
          {preview ? (
            <div style={detailGridStyle}>
              <div style={headerRowStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>{preview.displayName}</h2>
                  <div style={mutedTextStyle}>
                    {currentItem?.platform ?? "-"} · {preview.channel}
                  </div>
                </div>
                <span style={tagStyle}>{preview.deliveryStatus}</span>
              </div>

              <div style={statsGridStyle}>
                <div style={statCardStyle}>
                  <span style={mutedTextStyle}>권장 액션</span>
                  <strong>{preview.recommendedAction}</strong>
                </div>
                <div style={statCardStyle}>
                  <span style={mutedTextStyle}>승인 시각</span>
                  <strong>
                    {currentItem?.approvedAt
                      ? new Date(currentItem.approvedAt).toLocaleString("ko-KR")
                      : "-"}
                  </strong>
                </div>
                <div style={statCardStyle}>
                  <span style={mutedTextStyle}>발송 시각</span>
                  <strong>
                    {currentItem?.sentAt ? new Date(currentItem.sentAt).toLocaleString("ko-KR") : "-"}
                  </strong>
                </div>
              </div>

              {preview.safetyChecks.length ? (
                <div style={warningPanelStyle}>
                  <strong>Safety Checks</strong>
                  {preview.safetyChecks.map((warning) => (
                    <div key={warning} style={mutedTextStyle}>{warning}</div>
                  ))}
                </div>
              ) : null}

              <div style={warningPanelStyle}>
                <strong>Approval Context</strong>
                <div style={mutedTextStyle}>Operator: {operatorProfile.name} 쨌 Role: {operatorProfile.role}</div>
                <textarea
                  style={textareaStyle}
                  value={approvalNote}
                  onChange={(event) => setApprovalNote(event.target.value)}
                  placeholder="Approval note"
                />
              </div>

              <label style={fieldStyle}>
                <span>제목</span>
                <input
                  style={inputStyle}
                  value={draftSubject}
                  onChange={(event) => setDraftSubject(event.target.value)}
                  placeholder="이메일 제목"
                />
              </label>

              <label style={fieldStyle}>
                <span>본문</span>
                <textarea
                  style={textareaStyle}
                  value={draftBody}
                  onChange={(event) => setDraftBody(event.target.value)}
                  placeholder="아웃리치 메시지 본문"
                />
              </label>

              <div style={actionRowStyle}>
                <label style={checkboxStyle}>
                  <input
                    type="checkbox"
                    checked={approveConfirmed}
                    onChange={(event) => setApproveConfirmed(event.target.checked)}
                  />
                  <span>Confirm approval</span>
                </label>
                <button
                  type="button"
                  style={ghostButtonStyle}
                  onClick={() => void approveDraft()}
                  disabled={!preview.canApprove || !canWrite || !approveConfirmed}
                >
                  초안 승인
                </button>
                <label style={checkboxStyle}>
                  <input
                    type="checkbox"
                    checked={sendConfirmed}
                    onChange={(event) => setSendConfirmed(event.target.checked)}
                  />
                  <span>Confirm email send</span>
                </label>
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={() => void sendEmail()}
                  disabled={!preview.canSendEmail || !canWrite || !sendConfirmed}
                >
                  이메일 발송 처리
                </button>
                <label style={checkboxStyle}>
                  <input
                    type="checkbox"
                    checked={queueConfirmed}
                    onChange={(event) => setQueueConfirmed(event.target.checked)}
                  />
                  <span>Confirm DM queue</span>
                </label>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => void queueDm()}
                  disabled={!preview.canQueueDm || !canWrite || !queueConfirmed}
                >
                  DM 큐 등록
                </button>
              </div>
            </div>
          ) : (
            <div style={emptyStyle}>왼쪽 목록에서 메시지 대상을 선택해주세요.</div>
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
    "radial-gradient(circle at top right, rgba(249, 115, 22, 0.16), transparent 24%), #020617",
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
  alignItems: "flex-end",
  gap: 24
};

const eyebrowStyle: CSSProperties = {
  color: "#fb923c",
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
  color: "#fdba74",
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
  background: "#431407",
  color: "#fdba74",
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

const mutedTextStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 14
};

const previewTextStyle: CSSProperties = {
  color: "#cbd5e1",
  lineHeight: 1.6
};

const tagStyle: CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  background: "#431407",
  color: "#fdba74",
  fontSize: 12
};

const detailGridStyle: CSSProperties = {
  display: "grid",
  gap: 16
};

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
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

const warningPanelStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  background: "#431407",
  border: "1px solid #9a3412",
  borderRadius: 16,
  padding: 14,
  color: "#ffedd5"
};

const warningListStyle: CSSProperties = {
  display: "grid",
  gap: 6
};

const warningTagStyle: CSSProperties = {
  borderRadius: 10,
  border: "1px solid #9a3412",
  background: "#431407",
  color: "#ffedd5",
  padding: "7px 10px",
  fontSize: 12
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 14,
  color: "#cbd5e1"
};

const checkboxStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
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

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10
};

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: "12px 16px",
  background: "#fb923c",
  color: "#431407",
  fontWeight: 700,
  cursor: "pointer"
};

const secondaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: "12px 16px",
  background: "#38bdf8",
  color: "#082f49",
  fontWeight: 700,
  cursor: "pointer"
};

const ghostButtonStyle: CSSProperties = {
  borderRadius: 12,
  padding: "12px 16px",
  border: "1px solid #334155",
  background: "transparent",
  color: "#e2e8f0",
  cursor: "pointer"
};

const emptyStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px dashed #334155",
  padding: 18,
  color: "#94a3b8",
  textAlign: "center"
};
