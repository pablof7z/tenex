"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { NDKProvider } from "@/components/providers/ndk";
import { AppLayout } from "@/components/app-layout";

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLandingPage = pathname === "/";
    
    return (
        <NDKProvider>
            {isLandingPage ? (
                // Don't wrap the landing page with AppLayout
                children
            ) : (
                // Apply AppLayout to all other pages
                <AppLayout>{children}</AppLayout>
            )}
        </NDKProvider>
    );
}