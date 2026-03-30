import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "nexusRAG - Intelligent Document Q&A System",
  description:
    "A high-performance Retrieval-Augmented Generation system for document processing, session-based chat, and intelligent question answering.",
  keywords: [
    "RAG",
    "Retrieval-Augmented Generation",
    "LangChain",
    "LangGraph",
    "AI",
    "Document Q&A",
    "Chat",
    "Supabase",
    "FastAPI",
    "Next.js",
  ],
  authors: [{ name: "Shuvam Santra" }],
  openGraph: {
    title: "nexusRAG - Intelligent Document Q&A System",
    description:
      "Upload documents and get intelligent answers powered by advanced RAG technology.",
    type: "website",
    siteName: "nexusRAG",
  },
  twitter: {
    card: "summary_large_image",
    title: "nexusRAG - Intelligent Document Q&A System",
    description:
      "Upload documents and get intelligent answers powered by advanced RAG technology.",
  },
};

import Providers from "./Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
