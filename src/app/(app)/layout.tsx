"use client";

import { TestBanner } from "@/components/test-banner";
import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <TestBanner />
      <Nav />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </ToastProvider>
  );
}
