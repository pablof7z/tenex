"use client";

import { useNDKCurrentPubkey, useNDKSessionLogout } from "@nostr-dev-kit/ndk-hooks"; // Removed useNDKSessionLogin, NDKNip07Signer, useProfile

import { Boxes, Home, LogOut, Settings } from "lucide-react"; // Removed LogIn
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react"; // Removed useEffect, useState
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider } from "@/components/ui/sidebar"; // Import SidebarProvider
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast"; // Keep for sidebar logout toast

export function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const currentPubkey = useNDKCurrentPubkey();
    const logout = useNDKSessionLogout(); // Keep for sidebar logout

    // Simplified handleLogout for the sidebar button
    const handleSidebarLogout = () => {
        console.log("Sidebar logout requested");
        logout();
        toast({
            title: "Logged Out",
            description: "You have been successfully logged out.",
        });
    };

    // Removed profile fetching - handled by UserDropdown

    return (
        <SidebarProvider>
            {" "}
            {/* Wrap the layout with SidebarProvider */}
            {/* Sidebar */}
            <aside className="hidden w-16 flex-col border-r border-border bg-card sm:flex">
                <div className="flex h-16 items-center justify-center border-b border-border">
                    <Link href="/dashboard" className="flex items-center justify-center">
                        <Boxes className="h-7 w-7" />
                    </Link>
                </div>
                <nav className="flex flex-1 flex-col gap-4 p-2">
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={pathname === "/dashboard" ? "secondary" : "ghost"}
                                    size="icon"
                                    className="h-12 w-12 rounded-md sidebar-icon"
                                    asChild
                                >
                                    <Link href="/dashboard">
                                        <Home className="h-5 w-5" />
                                        <span className="sr-only">Dashboard</span>
                                    </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">Dashboard</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={pathname === "/settings" ? "secondary" : "ghost"}
                                    size="icon"
                                    className="h-12 w-12 rounded-md sidebar-icon"
                                    asChild
                                >
                                    <Link href="/settings">
                                        <Settings className="h-5 w-5" />
                                        <span className="sr-only">Settings</span>
                                    </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">Settings</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <div className="flex-1" />
                    <Separator className="bg-border" />
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <ThemeToggle />
                            </TooltipTrigger>
                            <TooltipContent side="right">Logout</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-12 w-12 rounded-md sidebar-icon"
                                    onClick={handleSidebarLogout} // Use the sidebar-specific handler
                                    disabled={!currentPubkey}
                                >
                                    <LogOut className="h-5 w-5" />
                                    <span className="sr-only">Logout</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">Logout</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </nav>
            </aside>
            {/* Main content */}
            <div className="flex flex-1 flex-col">
                <main className="flex-1 p-4 sm:p-6 bg-background">{children}</main>
            </div>
        </SidebarProvider>
    );
}
