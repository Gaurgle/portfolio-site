import React from "react";
import { cn } from "../../lib/utils.ts";

type BorderBeamProps = {
    className?: string;
    length?: number;
    duration?: number;
    colorFrom?: string;
    colorVia?: string;
    colorTo?: string;
};

const BorderBeam: React.FC<BorderBeamProps> = ({
                                                   className,
                                                   length = 200,
                                                   duration = 10,
                                                   colorFrom = "#9d8cff",
                                                   colorVia = "#ff6b8b",
                                                   colorTo = "#8dffb0",
                                               }) => {
    const fadeLength = Math.round(length * 0.85);
    const blurAmount = Math.round(length * 0.25);
    const extendedLength = length + fadeLength * 2;

    const cssVariables = {
        ["--length" as any]: extendedLength,
        ["--duration" as any]: duration,
        ["--color-from" as any]: colorFrom,
        ["--color-via" as any]: colorVia,
        ["--color-to" as any]: colorTo,
        ["--fade-length" as any]: `${fadeLength}px`,
        ["--blur-amount" as any]: `${blurAmount}px`,
    } as React.CSSProperties;

    const beamStyles = cn(
        "after:content-['']",
        "![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]",
        "after:absolute after:inset-0 after:m-auto after:aspect-square after:w-[calc(var(--length)*1px)] after:animate-border-beam",
        "after:[background:linear-gradient(to_left,transparent,transparent_var(--fade-length),var(--color-from),var(--color-via),var(--color-to),transparent_calc(100%_-_var(--fade-length)),transparent)]",
        "after:[filter:blur(var(--blur-amount))]",
        "after:[offset-path:rect(0_auto_auto_0_round_calc(var(--length)*1px))]",
        "group-hover:after:[filter:blur(var(--blur-amount))_drop-shadow(0_0_6px_var(--color-from))_drop-shadow(0_0_8px_var(--color-via))_drop-shadow(0_0_10px_var(--color-to))]"
    );

    return (
        <div
            style={cssVariables}
            className={cn(
                "pointer-events-none absolute inset-0 rounded-[inherit] [border:1px_solid_transparent]",
                "opacity-30 transition-all duration-700 ease-in-out",
                "group-hover:opacity-80",
                "after:transition-[filter] after:duration-700 after:ease-in-out",
                beamStyles,
                className
            )}
        />
    );
};

export default BorderBeam;
