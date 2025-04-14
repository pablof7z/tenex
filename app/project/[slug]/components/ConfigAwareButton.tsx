import React from 'react';
import { Button, ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ConfigAwareButtonProps extends ButtonProps {
    isConfigReady: boolean;
    configNotReadyTooltip: string;
    tooltipContent?: React.ReactNode; // Optional tooltip for when button is enabled
    children: React.ReactNode;
}

export function ConfigAwareButton({
    isConfigReady,
    configNotReadyTooltip,
    tooltipContent,
    children,
    disabled,
    ...buttonProps
}: ConfigAwareButtonProps) {
    const finalDisabled = disabled || !isConfigReady;
    // Determine if any tooltip should be shown
    const showTooltip = !isConfigReady || tooltipContent;

    // It's often safer to wrap the trigger element if it's complex or might change
    const triggerElement = (
        <Button {...buttonProps} disabled={finalDisabled}>
            {children}
        </Button>
    );

    if (!showTooltip) {
        // Render the button directly if no tooltip is needed
        return triggerElement;
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    {/* Using a span wrapper can sometimes help with complex triggers */}
                    <span>{triggerElement}</span>
                </TooltipTrigger>
                <TooltipContent>
                    {/* Show config tooltip if not ready, otherwise show the provided tooltip */}
                    {!isConfigReady ? configNotReadyTooltip : tooltipContent}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}