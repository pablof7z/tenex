"use client";

// Removed useState, useEffect
import Link from "next/link";
import { ArrowRight, Boxes, Code, GitBranch, Hash, LogOut, MessageSquare, Zap } from "lucide-react"; // Removed LogIn
// Removed NDK hooks related to login/logout/session state here
// Removed NDKUser type import

import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
// Removed Avatar imports
// Removed DropdownMenu imports
import { UserDropdown } from "@/components/navigation/user-dropdown"; // Import the new component

export default function LandingPage() {
    // Removed session hooks, login/logout hooks, isLoading state, activeUser state

    // Removed useEffect for fetching user
    // Removed handleLogin
    // Removed handleLogout

    return (
        <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center justify-between">
                    <div className="flex items-center gap-2 font-medium text-lg">
                        <Boxes className="h-6 w-6" />
                        <span>TENEX</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Button variant="ghost" asChild>
                            <Link href="/about">About</Link>
                        </Button>
                        <Button variant="ghost" asChild>
                            <Link href="/features">Features</Link>
                        </Button>
                        <Button variant="ghost" asChild>
                            <Link href="/docs">Docs</Link>
                        </Button>
                        <UserDropdown /> {/* Use the new UserDropdown component */}
                    </div>
                </div>
            </header>
            <main className="flex-1">
                <section className="container py-24 sm:py-32">
                    <div className="mx-auto flex max-w-[980px] flex-col items-center gap-4 text-center">
                        <h1 className="text-4xl font-medium leading-tight tracking-tight md:text-6xl lg:text-7xl lg:leading-[1.1]">
                            Project Management for the Nostr Ecosystem
                        </h1>
                        <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
                            Seamlessly manage your projects, collaborate with others, and stay updated with real-time
                            feeds from the Nostr network.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
                            <Button
                                size="lg"
                                className="rounded-md px-8"
                                // onClick logic needs adjustment - UserDropdown handles login internally
                                // We need a way to know if the user *is* logged in to change the button behavior
                                // For now, let's keep the button text static or link directly to dashboard
                                // A better solution would involve lifting state or using a shared context/store
                                onClick={() => window.location.href = "/dashboard"} // Simplification: always go to dashboard
                            >
                                Get Started {/* Simplification: Static text */}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="lg" className="rounded-md px-8" asChild>
                                <Link href="/demo">View Demo</Link>
                            </Button>
                        </div>
                    </div>
                </section>

                <section className="container py-14 sm:py-20">
                    <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 md:grid-cols-3">
                        <div className="flex flex-col items-center gap-3 text-center group">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                                <Zap className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-medium">NIP-07 Integration</h3>
                            <p className="text-muted-foreground">
                                Securely login with your Nostr extension and manage your projects with your identity.
                            </p>
                        </div>
                        <div className="flex flex-col items-center gap-3 text-center group">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                                <Boxes className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-medium">Project Dashboard</h3>
                            <p className="text-muted-foreground">
                                View all your projects at a glance with recent activity and progress indicators.
                            </p>
                        </div>
                        <div className="flex flex-col items-center gap-3 text-center group">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                                <Code className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-medium">VS Code Integration</h3>
                            <p className="text-muted-foreground">
                                Launch your code editor directly from the app to start working on your project.
                            </p>
                        </div>
                        <div className="flex flex-col items-center gap-3 text-center group">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                                <MessageSquare className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-medium">Activity Feeds</h3>
                            <p className="text-muted-foreground">
                                Stay updated with project-specific activity and engage with relevant conversations.
                            </p>
                        </div>
                        <div className="flex flex-col items-center gap-3 text-center group">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                                <Hash className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-medium">Hashtag Monitoring</h3>
                            <p className="text-muted-foreground">
                                Track conversations related to your project across the Nostr network.
                            </p>
                        </div>
                        <div className="flex flex-col items-center gap-3 text-center group">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                                <GitBranch className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-medium">Task Management</h3>
                            <p className="text-muted-foreground">
                                Create, assign, and track tasks to keep your project moving forward.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="border-t bg-secondary/50">
                    <div className="container py-14 sm:py-20">
                        <div className="mx-auto flex max-w-5xl flex-col gap-8 md:flex-row">
                            <div className="flex-1 space-y-4">
                                <h2 className="text-3xl font-medium tracking-tight">How It Works</h2>
                                <p className="text-muted-foreground">
                                    NostrPM connects to the Nostr network to provide a seamless project management
                                    experience.
                                </p>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-2">
                                        <ArrowRight className="mt-1 h-4 w-4" />
                                        <span>
                                            Create projects with name, tagline, product spec, and related hashtags
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <ArrowRight className="mt-1 h-4 w-4" />
                                        <span>View activity feeds from project agents with real-time updates</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <ArrowRight className="mt-1 h-4 w-4" />
                                        <span>Edit product specs with a powerful WYSIWYG editor</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <ArrowRight className="mt-1 h-4 w-4" />
                                        <span>Monitor relevant conversations across the Nostr network</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <ArrowRight className="mt-1 h-4 w-4" />
                                        <span>Manage tasks and track project progress</span>
                                    </li>
                                </ul>
                                <div className="pt-4">
                                    {/* Removed Link wrapper, login handled by header */}
                                    <Button
                                        className="rounded-md px-6"
                                        // Same simplification as above
                                        onClick={() => window.location.href = "/dashboard"}
                                    >
                                        Get Started Now {/* Simplification: Static text */}
                                    </Button>
                                </div>
                            </div>
                            <div className="flex flex-1 items-center justify-center rounded-md border bg-card p-4 shadow-sm">
                                <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
                                    <img
                                        src="/placeholder.svg?height=400&width=600"
                                        alt="NostrPM Dashboard Preview"
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <footer className="border-t py-8 bg-background">
                <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
                    <div className="flex items-center gap-2">
                        <Boxes className="h-5 w-5" />
                        <p className="text-sm font-medium">NostrPM &copy; {new Date().getFullYear()}</p>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                        <Link href="/privacy" className="hover:text-foreground/70 transition-colors">
                            Privacy
                        </Link>
                        <Link href="/terms" className="hover:text-foreground/70 transition-colors">
                            Terms
                        </Link>
                        <Link href="/contact" className="hover:text-foreground/70 transition-colors">
                            Contact
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
