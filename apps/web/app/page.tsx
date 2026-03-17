const routes = [
  { href: "/settings", label: "설정" },
  { href: "/leads", label: "리드" },
  { href: "/review", label: "검수 큐" },
  { href: "/outreach", label: "아웃리치 큐" },
  { href: "/crm", label: "CRM" },
  { href: "/onboarding", label: "온보딩" }
];

export default function HomePage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Seller Find</h1>
      <p>SellerOutreachMVP 문서를 기반으로 만든 운영도구 시작 골격입니다.</p>
      <ul>
        {routes.map((route) => (
          <li key={route.href}>
            <a href={route.href} style={{ color: "#7dd3fc" }}>
              {route.label}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
