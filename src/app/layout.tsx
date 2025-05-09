'use client'; // Need client component for APIProvider and Toaster

import type { ReactNode } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Header } from '@/components/layout/header';
import Providers from '@/components/providers';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Metadata is handled differently in client components,
// Consider moving metadata to a server component layout wrapper if needed for SEO.
// export const metadata: Metadata = {
//   title: 'RouteSnap',
//   description: 'Plan and share your routes with photos',
// };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <div className="flex h-screen items-center justify-center">
            <p className="text-destructive">
              Error: Google Maps API Key is missing. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file.
            </p>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <APIProvider apiKey={apiKey} libraries={['marker', 'routes', 'places']}>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-grow">{children}</main>
              <Toaster />
            </div>
          </APIProvider>
        </Providers>
      </body>
    </html>
  );
