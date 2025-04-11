"use client";

import React from "react"; // Removed useEffect, useState

import { Boxes, Home, LogOut, Settings, Users } from "lucide-react"; // Removed LogIn
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { useNDKSessions, useNDKSessionLogout, useNDKCurrentUser } from "@nostr-dev-kit/ndk-hooks"; // Removed useNDKSessionLogin, NDKNip07Signer, useProfile

import { toast } from "@/components/ui/use-toast"; // Keep for sidebar logout toast
// Removed Avatar imports
// Removed DropdownMenu imports
import { UserDropdown } from "./navigation/user-dropdown"; // Import the new component
import { SidebarProvider } from "@/components/ui/sidebar"; // Import SidebarProvider

export function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const sessions = useNDKSessions();
    const logout = useNDKSessionLogout(); // Keep for sidebar logout
    const currentUser = useNDKCurrentUser(); // Keep for potential conditional rendering or checks

    // Removed handleLogin - now handled by UserDropdown

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
                        <span className="sr-only">NostrPM</span>
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
                                    variant={pathname.startsWith("/team") ? "secondary" : "ghost"}
                                    size="icon"
                                    className="h-12 w-12 rounded-md sidebar-icon"
                                    asChild
                                >
                                    <Link href="/team">
                                        <Users className="h-5 w-5" />
                                        <span className="sr-only">Team</span>
                                    </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">Team</TooltipContent>
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
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-12 w-12 rounded-md sidebar-icon"
                                    onClick={handleSidebarLogout} // Use the sidebar-specific handler
                                    disabled={!sessions.activePubkey}
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
                {/* Header */}
                <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 sm:px-6">
                    <div className="flex flex-1 items-center gap-2">
                        <Button variant="ghost" size="icon" className="sm:hidden">
                            <Boxes className="h-6 w-6" />
                            <span className="sr-only">Home</span>
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <UserDropdown /> {/* Use the new UserDropdown component */}
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 p-4 sm:p-6 bg-background">{children}</main>
            </div>
        </SidebarProvider>
    );
}
