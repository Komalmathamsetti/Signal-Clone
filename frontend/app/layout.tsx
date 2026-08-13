import type { Metadata } from "next";
import "./globals.css";
import ToastProvider from "./toasterProvider";
export const metadata: Metadata = {
  title: "Signal — Secure Messaging",
  description: "A Signal-inspired secure messaging platform"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ToastProvider/>
      </body>
    </html>
  );
}
