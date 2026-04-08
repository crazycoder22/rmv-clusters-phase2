import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import NoticeBanner from "@/components/layout/NoticeBanner";
import PopupManager from "@/components/popups/PopupManager";
import SessionProvider from "@/components/auth/SessionProvider";
import siteData from "@/data/site.json";
import type { NoticeBanner as NoticeBannerType } from "@/types";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-newspaper-display",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-newspaper-body",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: siteData.name,
    template: `%s | ${siteData.name}`,
  },
  description: `Official community website for ${siteData.name} apartment complex in Devinagar, Bengaluru.`,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteData.name,
  },
  openGraph: {
    title: siteData.name,
    description: `Official community website for ${siteData.name}`,
    siteName: siteData.name,
    locale: "en_IN",
    type: "website",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e40af",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'){document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} ${sourceSerif.variable} antialiased`}
      >
        <SessionProvider>
          {siteData.noticeBanner && (
            <NoticeBanner
              banner={siteData.noticeBanner as NoticeBannerType}
            />
          )}
          <PopupManager />
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
