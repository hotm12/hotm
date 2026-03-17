import type { ReactNode } from "react";

export const metadata = {
  title: "Seller Find",
  description: "Seller outreach operator console"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          fontFamily: "Segoe UI, sans-serif",
          background: "#0f172a",
          color: "#e2e8f0"
        }}
      >
        {children}
      </body>
    </html>
  );
}
