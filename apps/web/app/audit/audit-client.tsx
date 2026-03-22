"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type AuditLogItem = {
  id: number;
  entityType: string;
  entityId: number;
  actionType: string;
  actor?: string;
  summary?: string;
  detail?: string;
  createdAt: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const fallbackItems: AuditLogItem[] = [
  {
    id: 1,
    entityType: "LEAD",
    entityId: 3,
    actionType: "ONBOARDING_STARTED",
    actor: "system",
    summary: "온보딩 시작",
    detail: "상품 카탈로그 요청 단계로 이동했습니다.",
    createdAt: "2026-03-18T03:00:00Z"
  }
];

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export function AuditClient() {
  const [items, setItems] = useState<AuditLogItem[]>(fallbackItems);
  const [statusMessage, setStatusMessage] = useState("감사 로그를 불러오는 중입니다.");

  useEffect(() => {
    void loadAuditLogs();
  }, []);

  async function loadAuditLogs() {
    try {
      const nextItems = await request<AuditLogItem[]>("/audit-log?limit=40");
      setItems(nextItems);
      setStatusMessage("API에서 최신 감사 로그를 불러왔습니다.");
    } catch {
      setItems(fallbackItems);
      setStatusMessage("API 연결이 없어 예시 감사 로그를 표시 중입니다.");
    }
  }

  return (
    <main style={pageStyle}>
      <section style={headerStyle}>
        <div>
          <h1 style={{ margin: "0 0 10px" }}>감사 로그</h1>
          <p style={headerDescriptionStyle}>
            주요 검수, 아웃리치, CRM, 온보딩 변경 이력을 시간순으로 확인할 수 있습니다.
          </p>
        </div>
        <div style={statusStyle}>{statusMessage}</div>
      </section>

      <section style={listStyle}>
        {items.map((item) => (
          <article key={item.id} style={cardStyle}>
            <div style={topRowStyle}>
              <div>
                <strong>{item.summary ?? item.actionType}</strong>
                <div style={accentStyle}>
                  {item.entityType} #{item.entityId}
                </div>
              </div>
              <div style={metaStyle}>{new Date(item.createdAt).toLocaleString("ko-KR")}</div>
            </div>
            {item.detail ? <p style={detailStyle}>{item.detail}</p> : null}
            <div style={metaStyle}>{item.actor ? `actor: ${item.actor}` : item.actionType}</div>
          </article>
        ))}
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 32,
  background:
    "linear-gradient(180deg, rgba(14, 165, 233, 0.12) 0%, rgba(2, 6, 23, 0) 22%), #020617",
  color: "#e2e8f0",
  display: "grid",
  gap: 20
};

const headerStyle: CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid #1e293b",
  borderRadius: 22,
  padding: 24,
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  alignItems: "flex-end"
};

const headerDescriptionStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  lineHeight: 1.7
};

const statusStyle: CSSProperties = {
  color: "#7dd3fc",
  fontSize: 14,
  maxWidth: 320,
  textAlign: "right"
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 14
};

const cardStyle: CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid #1e293b",
  borderRadius: 18,
  padding: 18,
  display: "grid",
  gap: 10
};

const topRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16
};

const accentStyle: CSSProperties = {
  color: "#7dd3fc",
  marginTop: 8
};

const detailStyle: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.7
};

const metaStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 13
};
