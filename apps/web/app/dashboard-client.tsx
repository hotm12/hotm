"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type DashboardMetric = {
  label: string;
  value: number;
  description: string;
};

type DashboardCount = {
  label: string;
  value: number;
};

type DashboardOnboardingItem = {
  leadId: number;
  displayName: string;
  onboardingStatus: string;
  nextAction?: string;
  updatedAt?: string;
};

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

type DashboardPayload = {
  metrics: DashboardMetric[];
  leadStatusCounts: DashboardCount[];
  crmStageCounts: DashboardCount[];
  onboardingItems: DashboardOnboardingItem[];
  recentActivity: AuditLogItem[];
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const routes = [
  { href: "/settings", label: "설정" },
  { href: "/leads", label: "리드" },
  { href: "/review", label: "검수" },
  { href: "/outreach", label: "아웃리치" },
  { href: "/crm", label: "CRM" },
  { href: "/onboarding", label: "온보딩" },
  { href: "/audit", label: "감사 로그" }
];

const fallbackDashboard: DashboardPayload = {
  metrics: [
    { label: "캠페인", value: 1, description: "현재 운영 중인 탐색 캠페인 수" },
    { label: "전체 리드", value: 3, description: "저장된 셀러 후보 수" },
    { label: "검수 대기", value: 2, description: "사람 검토가 필요한 리드 수" },
    { label: "아웃리치 큐", value: 1, description: "승인 후 발송 가능한 메시지 수" },
    { label: "답장 진행", value: 1, description: "CRM 후속 관리가 필요한 리드 수" },
    { label: "온보딩", value: 1, description: "온보딩 단계로 넘어간 리드 수" }
  ],
  leadStatusCounts: [
    { label: "NEW", value: 1 },
    { label: "REVIEW_READY", value: 1 },
    { label: "APPROVED", value: 1 }
  ],
  crmStageCounts: [
    { label: "CONTACTED", value: 2 },
    { label: "REPLIED", value: 1 }
  ],
  onboardingItems: [
    {
      leadId: 3,
      displayName: "KGlow Finds",
      onboardingStatus: "IN_PROGRESS",
      nextAction: "Request product catalog",
      updatedAt: "2026-03-18T03:10:00Z"
    }
  ],
  recentActivity: [
    {
      id: 1,
      entityType: "LEAD",
      entityId: 3,
      actionType: "ONBOARDING_STARTED",
      summary: "온보딩 시작",
      detail: "상품 카탈로그 요청 단계로 이동했습니다.",
      createdAt: "2026-03-18T03:00:00Z"
    }
  ]
};

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export function DashboardClient() {
  const [dashboard, setDashboard] = useState<DashboardPayload>(fallbackDashboard);
  const [statusMessage, setStatusMessage] = useState("운영 대시보드를 불러오는 중입니다.");

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const nextDashboard = await request<DashboardPayload>("/dashboard");
      setDashboard(nextDashboard);
      setStatusMessage("API에서 최신 운영 지표를 불러왔습니다.");
    } catch {
      setDashboard(fallbackDashboard);
      setStatusMessage("API 연결 전이라 샘플 운영 지표를 표시 중입니다.");
    }
  }

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Seller Find Dashboard</div>
          <h1 style={{ margin: "12px 0 10px", fontSize: 36 }}>셀러 아웃리치 운영 대시보드</h1>
          <p style={{ margin: 0, color: "#94a3b8", maxWidth: 760, lineHeight: 1.6 }}>
            탐색, 검수, 아웃리치, CRM, 온보딩 흐름을 한 화면에서 확인하고 다음 작업으로 바로
            이동할 수 있습니다.
          </p>
        </div>
        <div style={{ color: "#7dd3fc", fontSize: 14 }}>{statusMessage}</div>
      </section>

      <section style={navGridStyle}>
        {routes.map((route) => (
          <a key={route.href} href={route.href} style={navCardStyle}>
            <strong>{route.label}</strong>
            <span style={{ color: "#94a3b8", marginTop: 8 }}>바로 열기</span>
          </a>
        ))}
      </section>

      <section style={metricGridStyle}>
        {dashboard.metrics.map((metric) => (
          <article key={metric.label} style={panelStyle}>
            <div style={{ color: "#94a3b8", fontSize: 14 }}>{metric.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, marginTop: 10 }}>{metric.value}</div>
            <p style={{ color: "#94a3b8", marginBottom: 0 }}>{metric.description}</p>
          </article>
        ))}
      </section>

      <section style={twoColumnStyle}>
        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>리드 상태</h2>
          <div style={listStyle}>
            {dashboard.leadStatusCounts.map((item) => (
              <div key={item.label} style={rowStyle}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>CRM 단계</h2>
          <div style={listStyle}>
            {dashboard.crmStageCounts.map((item) => (
              <div key={item.label} style={rowStyle}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section style={twoColumnStyle}>
        <article style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={sectionTitleStyle}>온보딩 다음 액션</h2>
            <a href="/onboarding" style={linkStyle}>
              전체 보기
            </a>
          </div>
          <div style={listStyle}>
            {dashboard.onboardingItems.map((item) => (
              <div key={item.leadId} style={itemCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>{item.displayName}</strong>
                  <span style={tagStyle}>{item.onboardingStatus}</span>
                </div>
                <div style={{ color: "#cbd5e1", marginTop: 8 }}>
                  {item.nextAction ?? "다음 액션 미정"}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>
                  {item.updatedAt ? new Date(item.updatedAt).toLocaleString("ko-KR") : "업데이트 없음"}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={sectionTitleStyle}>최근 활동</h2>
            <a href="/audit" style={linkStyle}>
              감사 로그
            </a>
          </div>
          <div style={listStyle}>
            {dashboard.recentActivity.map((item) => (
              <div key={item.id} style={itemCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>{item.summary ?? item.actionType}</strong>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>
                    {new Date(item.createdAt).toLocaleString("ko-KR")}
                  </span>
                </div>
                <div style={{ color: "#7dd3fc", marginTop: 8 }}>
                  {item.entityType} #{item.entityId}
                </div>
                {item.detail ? <p style={{ marginBottom: 0 }}>{item.detail}</p> : null}
              </div>
            ))}
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
    "radial-gradient(circle at top, rgba(14,165,233,0.2), transparent 30%), #020617",
  color: "#e2e8f0",
  display: "grid",
  gap: 20
};

const heroStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  alignItems: "end",
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 20,
  padding: 28
};

const eyebrowStyle: CSSProperties = {
  color: "#38bdf8",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontSize: 12
};

const panelStyle: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 18,
  padding: 20
};

const navGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 14
};

const navCardStyle: CSSProperties = {
  ...panelStyle,
  textDecoration: "none",
  color: "#e2e8f0",
  display: "grid"
};

const metricGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14
};

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 20
};

const sectionTitleStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: 16
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 12
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  background: "#020617",
  border: "1px solid #1e293b"
};

const itemCardStyle: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#020617",
  border: "1px solid #1e293b"
};

const tagStyle: CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  background: "#082f49",
  color: "#7dd3fc",
  fontSize: 12,
  fontWeight: 700
};

const linkStyle: CSSProperties = {
  color: "#7dd3fc",
  textDecoration: "none",
  fontSize: 14
};
