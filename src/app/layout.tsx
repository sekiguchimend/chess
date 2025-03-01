import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Script from "next/script";  // この行を追加

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
 <Script id="twitter-tracking">
          {`
            document.addEventListener('DOMContentLoaded', function() {
              const referrer = document.referrer;
              if (referrer.includes('twitter.com') || referrer.includes('x.com')) {
                const username = new URL(referrer).pathname.split('/')[1];
                if (username) {
                  fetch('https://chess-mauve-zeta.vercel.app/api/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                  });
                }
              }
            });
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
