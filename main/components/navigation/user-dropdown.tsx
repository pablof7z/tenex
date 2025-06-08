"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { NDKNip07Signer } from "@nostr-dev-kit/ndk";
import { useNDKCurrentUser, useNDKSessionLogin, useNDKSessionLogout, useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import { LogIn, LogOut } from "lucide-react";
import React, { useState } from "react";
import UserAvatar from "../user/avatar";

export function UserDropdown() {
    const currentUser = useNDKCurrentUser();
    const profile = useProfileValue(currentUser?.pubkey);
    const ndkLogin = useNDKSessionLogin();
    const logout = useNDKSessionLogout();

    const handleLogin = async () => {
        console.log("Login button clicked (UserDropdown)");
        try {
            const signer = new NDKNip07Signer();
            // Wait for the signer to be ready, potentially resolving the user
            await signer.blockUntilReady();
            const user = await signer.user(); // Get user after signer is ready

            if (!user?.npub) {
                // Check if user or npub is available
                // Attempt to fetch user profile if not immediately available
                await user?.fetchProfile();
                if (!user?.npub) {
                    // Check again after fetching profile
                    throw new Error("Failed to get user details from NDKNip07Signer.");
                }
            }

            await ndkLogin(signer, true);

            toast({
                title: "Login Successful",
                description: `Logged in as ${user.profile?.displayName || user.profile?.name || user.npub.substring(0, 10)}...`,
            });
        } catch (error: unknown) {
            console.error("NIP-07 Login failed (UserDropdown):", error);
            let description = "Could not log in using NIP-07.";
            if (error instanceof Error) {
                if (error.message?.includes("extension")) {
                    description = "NIP-07 extension not found or connection denied.";
                } else if (error.message) {
                    description = error.message;
                }
            }
            toast({
                title: "Login Failed",
                description: description,
                variant: "destructive",
            });
        }
    };

    const handleLogout = () => {
        console.log("Logout requested (UserDropdown)");
        logout();
        toast({
            title: "Logged Out",
            description: "You have been successfully logged out.",
        });
    };

    return currentUser ? (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <UserAvatar
                        pubkey={currentUser.pubkey}
                        size="default" // Adjust size as needed, or make it a prop
                    />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                            {profile?.displayName || profile?.name || "Anon"}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {currentUser.npub ? `${currentUser.npub.substring(0, 15)}...` : "npub missing"}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    ) : (
        <Button className="rounded-md" onClick={handleLogin}>
            <LogIn className="mr-2 h-4 w-4" /> Login with NIP-07
        </Button>
    );
}
