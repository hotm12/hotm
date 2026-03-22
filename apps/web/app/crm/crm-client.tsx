"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type CrmBoardCard = {
  leadId: number;
  displayName: string;
  handle: string;
  platform: string;
  crmStage: string;
  totalScore: number;
  scoreGrade: string;
  latestReplyType?: string;
  latestActivitySummary?: string;
};

type CrmBoardColumn = {
  stage: string;
  items: CrmBoardCard[];
};

type ReplyItem = {
  id: number;
  leadId: number;
  channel: string;
  replyType: string;
  messageBody: string;
  receivedAt: string;
};

type ActivityItem = {
  id: number;
  leadId: number;
  activityType: string;
  summary: string;
  detail?: string;
  occurredAt: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const fallbackBoard: CrmBoardColumn[] = [
  {
    stage: "CONTACTED",
    items: []
  },
  {
    stage: "REPLIED",
    items: [
      {
        leadId: 3,
        displayName: "KGlow Finds",
        handle: "@kglow_finds",
        platform: "TIKTOK",
        crmStage: "REPLIED",
        totalScore: 40,
        scoreGrade: "A",
        latestReplyType: "POSITIVE",
        latestActivitySummary: "긍정 답장 확인"
      }
    ]
  },
  {
    stage: "INTERESTED",
    items: []
  },
  {
    stage: "MEETING_BOOKED",
    items: []
  },
  {
    stage: "ONBOARDING",
    items: []
  }
];

const fallbackReplies: ReplyItem[] = [
  {
    id: 1,
    leadId: 3,
    channel: "EMAIL",
    replyType: "POSITIVE",
    messageBody: "흥미롭습니다. 온보딩 절차와 필요 자료를 더 보내주세요.",
    receivedAt: "2026-03-18T02:00:00Z"
  }
];

const fallbackActivities: ActivityItem[] = [
  {
    id: 1,
    leadId: 3,
    activityType: "FOLLOW_UP_NOTE",
    summary: "긍정 답장 접수",
    detail: "카탈로그 요청 준비 중",
    occurredAt: "2026-03-18T02:10:00Z"
  }
];

const stageOptions = ["CONTACTED", "REPLIED", "INTERESTED", "MEETING_BOOKED", "ONBOARDING"];

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

export function CrmClient() {
  const [columns, setColumns] = useState<CrmBoardColumn[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [nextStage, setNextStage] = useState("REPLIED");
  const [replyForm, setReplyForm] = useState({
    channel: "EMAIL",
    replyType: "POSITIVE",
    messageBody: ""
  });
  const [activityForm, setActivityForm] = useState({
    activityType: "FOLLOW_UP_NOTE",
    summary: "",
    detail: ""
  });
  const [statusMessage, setStatusMessage] = useState("CRM 보드를 불러오는 중입니다.");

  const selectedCard = useMemo(
    () => columns.flatMap((column) => column.items).find((item) => item.leadId === selectedLeadId) ?? null,
    [columns, selectedLeadId]
  );

  useEffect(() => {
    void loadBoard();
  }, []);

  async function loadBoard(preferredLeadId?: number | null) {
    try {
      const nextColumns = await request<CrmBoardColumn[]>("/crm/board");
      setColumns(nextColumns);

      const flattened = nextColumns.flatMap((column) => column.items);
      const nextLeadId =
        flattened.find((item) => item.leadId === preferredLeadId)?.leadId ?? flattened[0]?.leadId ?? null;

      setSelectedLeadId(nextLeadId);

      if (nextLeadId) {
        await loadLeadWorkspace(nextLeadId);
      } else {
        setReplies([]);
        setActivities([]);
      }

      setStatusMessage("API에서 최신 CRM 보드를 불러왔습니다.");
    } catch {
      setColumns(fallbackBoard);
      setSelectedLeadId(3);
      setReplies(fallbackReplies);
      setActivities(fallbackActivities);
      setStatusMessage("API 연결이 없어 예시 CRM 데이터를 표시 중입니다.");
    }
  }

  async function loadLeadWorkspace(leadId: number) {
    try {
      const [nextReplies, nextActivities] = await Promise.all([
        request<ReplyItem[]>(`/crm/${leadId}/replies`),
        request<ActivityItem[]>(`/crm/${leadId}/activities`)
      ]);

      setReplies(nextReplies);
      setActivities(nextActivities);
    } catch {
      setReplies(fallbackReplies.filter((item) => item.leadId === leadId));
      setActivities(fallbackActivities.filter((item) => item.leadId === leadId));
    }
  }

  async function moveStage() {
    if (!selectedLeadId) {
      return;
    }

    try {
      await request("/crm/move-stage", {
        method: "POST",
        body: JSON.stringify({
          leadId: selectedLeadId,
          nextStage
        })
      });

      await loadBoard(selectedLeadId);
      setStatusMessage(`CRM 단계를 ${nextStage}로 이동했습니다.`);
    } catch {
      setStatusMessage("CRM 단계 이동에 실패했습니다.");
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedLeadId) {
      return;
    }

    try {
      await request("/crm/replies", {
        method: "POST",
        body: JSON.stringify({
          leadId: selectedLeadId,
          channel: replyForm.channel,
          replyType: replyForm.replyType,
          messageBody: replyForm.messageBody
        })
      });

      setReplyForm({
        channel: "EMAIL",
        replyType: "POSITIVE",
        messageBody: ""
      });
      await loadBoard(selectedLeadId);
      setStatusMessage("답장을 등록했습니다.");
    } catch {
      setStatusMessage("답장 등록에 실패했습니다.");
    }
  }

  async function submitActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedLeadId) {
      return;
    }

    try {
      await request("/crm/activities", {
        method: "POST",
        body: JSON.stringify({
          leadId: selectedLeadId,
          activityType: activityForm.activityType,
          summary: activityForm.summary,
          detail: activityForm.detail || undefined
        })
      });

      setActivityForm({
        activityType: "FOLLOW_UP_NOTE",
        summary: "",
        detail: ""
      });
      await loadLeadWorkspace(selectedLeadId);
      setStatusMessage("활동 메모를 등록했습니다.");
    } catch {
      setStatusMessage("활동 메모 등록에 실패했습니다.");
    }
  }

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>CRM Board</div>
          <h1 style={titleStyle}>답장과 후속 관리 워크스페이스</h1>
          <p style={descriptionStyle}>
            단계별 진행 현황을 보고, 답장 등록과 활동 메모를 남기며 CRM 단계를 앞으로 이동할 수 있습니다.
          </p>
        </div>
        <div style={statusMessageStyle}>{statusMessage}</div>
      </section>

      <section style={boardStyle}>
        {columns.map((column) => (
          <article key={column.stage} style={columnStyle}>
            <div style={columnHeaderStyle}>
              <strong>{column.stage}</strong>
              <span style={badgeStyle}>{column.items.length}</span>
            </div>
            <div style={listStyle}>
              {column.items.map((item) => (
                <button
                  key={item.leadId}
                  type="button"
                  onClick={() => {
                    setSelectedLeadId(item.leadId);
                    setNextStage(item.crmStage);
                    void loadLeadWorkspace(item.leadId);
                  }}
                  style={{
                    ...cardButtonStyle,
                    borderColor: item.leadId === selectedLeadId ? "#38bdf8" : "#1e293b"
                  }}
                >
                  <div style={rowStyle}>
                    <strong>{item.displayName}</strong>
                    <span style={tagStyle}>{item.scoreGrade}</span>
                  </div>
                  <div style={mutedTextStyle}>
                    {item.handle} · {item.platform}
                  </div>
                  <div style={metaRowStyle}>
                    <span>점수 {item.totalScore}</span>
                    <span>{item.latestReplyType ?? "답장 없음"}</span>
                  </div>
                  <div style={summaryTextStyle}>{item.latestActivitySummary ?? "최근 활동 없음"}</div>
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section style={detailLayoutStyle}>
        <article style={panelStyle}>
          {selectedCard ? (
            <div style={detailGridStyle}>
              <div style={rowStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>{selectedCard.displayName}</h2>
                  <div style={mutedTextStyle}>
                    {selectedCard.handle} · {selectedCard.platform}
                  </div>
                </div>
                <span style={tagStyle}>{selectedCard.crmStage}</span>
              </div>

              <div style={stageMoveStyle}>
                <select
                  style={inputStyle}
                  value={nextStage}
                  onChange={(event) => setNextStage(event.target.value)}
                >
                  {stageOptions.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
                <button type="button" style={primaryButtonStyle} onClick={() => void moveStage()}>
                  단계 이동
                </button>
              </div>

              <div style={twoColumnStyle}>
                <section style={sectionBlockStyle}>
                  <h3 style={subTitleStyle}>답장 등록</h3>
                  <form style={listStyle} onSubmit={submitReply}>
                    <select
                      style={inputStyle}
                      value={replyForm.channel}
                      onChange={(event) =>
                        setReplyForm((current) => ({ ...current, channel: event.target.value }))
                      }
                    >
                      <option value="EMAIL">EMAIL</option>
                      <option value="DM">DM</option>
                    </select>
                    <select
                      style={inputStyle}
                      value={replyForm.replyType}
                      onChange={(event) =>
                        setReplyForm((current) => ({ ...current, replyType: event.target.value }))
                      }
                    >
                      <option value="POSITIVE">POSITIVE</option>
                      <option value="NEUTRAL">NEUTRAL</option>
                      <option value="NEGATIVE">NEGATIVE</option>
                    </select>
                    <textarea
                      style={textareaStyle}
                      value={replyForm.messageBody}
                      onChange={(event) =>
                        setReplyForm((current) => ({ ...current, messageBody: event.target.value }))
                      }
                      placeholder="답장 내용을 입력하세요."
                      required
                    />
                    <button type="submit" style={primaryButtonStyle}>
                      답장 저장
                    </button>
                  </form>
                </section>

                <section style={sectionBlockStyle}>
                  <h3 style={subTitleStyle}>활동 메모 등록</h3>
                  <form style={listStyle} onSubmit={submitActivity}>
                    <input
                      style={inputStyle}
                      value={activityForm.activityType}
                      onChange={(event) =>
                        setActivityForm((current) => ({ ...current, activityType: event.target.value }))
                      }
                      placeholder="예: FOLLOW_UP_NOTE"
                      required
                    />
                    <input
                      style={inputStyle}
                      value={activityForm.summary}
                      onChange={(event) =>
                        setActivityForm((current) => ({ ...current, summary: event.target.value }))
                      }
                      placeholder="한 줄 요약"
                      required
                    />
                    <textarea
                      style={textareaStyle}
                      value={activityForm.detail}
                      onChange={(event) =>
                        setActivityForm((current) => ({ ...current, detail: event.target.value }))
                      }
                      placeholder="상세 메모"
                    />
                    <button type="submit" style={ghostButtonStyle}>
                      활동 메모 저장
                    </button>
                  </form>
                </section>
              </div>
            </div>
          ) : (
            <div style={emptyStyle}>보드에서 리드를 선택해주세요.</div>
          )}
        </article>

        <article style={panelStyle}>
          <div style={twoColumnStyle}>
            <section style={sectionBlockStyle}>
              <h3 style={subTitleStyle}>최근 답장</h3>
              <div style={listStyle}>
                {replies.map((reply) => (
                  <div key={reply.id} style={subCardStyle}>
                    <div style={rowStyle}>
                      <strong>{reply.replyType}</strong>
                      <span style={tagStyle}>{reply.channel}</span>
                    </div>
                    <div style={summaryTextStyle}>{reply.messageBody}</div>
                    <div style={mutedTextStyle}>{new Date(reply.receivedAt).toLocaleString("ko-KR")}</div>
                  </div>
                ))}
                {!replies.length ? <div style={emptyStyle}>등록된 답장이 없습니다.</div> : null}
              </div>
            </section>

            <section style={sectionBlockStyle}>
              <h3 style={subTitleStyle}>최근 활동</h3>
              <div style={listStyle}>
                {activities.map((activity) => (
                  <div key={activity.id} style={subCardStyle}>
                    <div style={rowStyle}>
                      <strong>{activity.summary}</strong>
                      <span style={tagStyle}>{activity.activityType}</span>
                    </div>
                    <div style={summaryTextStyle}>{activity.detail ?? "상세 메모 없음"}</div>
                    <div style={mutedTextStyle}>{new Date(activity.occurredAt).toLocaleString("ko-KR")}</div>
                  </div>
                ))}
                {!activities.length ? <div style={emptyStyle}>등록된 활동이 없습니다.</div> : null}
              </div>
            </section>
          </div>
        </article>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 32,
  background:
    "radial-gradient(circle at top right, rgba(56, 189, 248, 0.12), transparent 24%), #020617",
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
  color: "#7dd3fc",
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

const statusMessageStyle: CSSProperties = {
  color: "#7dd3fc",
  fontSize: 14,
  maxWidth: 320,
  textAlign: "right"
};

const boardStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16
};

const columnStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 18,
  borderRadius: 20,
  border: "1px solid #1e293b",
  background: "rgba(15, 23, 42, 0.9)"
};

const columnHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12
};

const badgeStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "#082f49",
  color: "#7dd3fc",
  fontSize: 12
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 12
};

const cardButtonStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 14,
  borderRadius: 16,
  border: "1px solid #1e293b",
  background: "#020617",
  color: "#e2e8f0",
  textAlign: "left",
  cursor: "pointer"
};

const detailLayoutStyle: CSSProperties = {
  display: "grid",
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

const detailGridStyle: CSSProperties = {
  display: "grid",
  gap: 16
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22
};

const subTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center"
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 13,
  color: "#cbd5e1"
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
  background: "#082f49",
  color: "#7dd3fc",
  fontSize: 12
};

const stageMoveStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap"
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
  minHeight: 112,
  resize: "vertical"
};

const primaryButtonStyle: CSSProperties = {
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

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16
};

const sectionBlockStyle: CSSProperties = {
  display: "grid",
  gap: 12
};

const subCardStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 14,
  borderRadius: 16,
  border: "1px solid #1e293b",
  background: "#020617"
};

const emptyStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px dashed #334155",
  padding: 18,
  color: "#94a3b8",
  textAlign: "center"
};
