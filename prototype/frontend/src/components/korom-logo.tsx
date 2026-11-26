import React from "react";
import { cn } from "@/lib/utils";

interface KoromKLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "solid" | "light" | "outline";
}

/**
 * Logo icône "K" officiel de Korom
 * Conçu avec la police Micro Bold et la palette de marque (#8067DC / #EFEAFF / #745DCA)
 */
export function KoromKLogo({
  className,
  size = "md",
  variant = "solid",
}: KoromKLogoProps) {
  const sizeClasses = {
    sm: "h-7 w-7 rounded-lg text-[16px]",
    md: "h-9 w-9 rounded-xl text-[21px]",
    lg: "h-12 w-12 rounded-2xl text-[28px]",
    xl: "h-16 w-16 rounded-[20px] text-[38px]",
  };

  const variantClasses = {
    solid: "bg-[#8067DC] text-[#EFEAFF] shadow-sm shadow-[#8067DC]/20 border border-[#745DCA]/30",
    light: "bg-[#EFEAFF] text-[#8067DC] border border-[#8067DC]/30 shadow-xs",
    outline: "bg-transparent text-[#8067DC] border-2 border-[#8067DC]",
  };

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center font-micro font-bold leading-none select-none transition-transform duration-150 hover:scale-[1.03]",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      aria-label="Logo Korom"
    >
      <span className="translate-y-[0.5px]">K</span>
    </div>
  );
}

/**
 * Logo complet officiel : Korom + séparateur + Copyrights & Royalties (Slide 1)
 */
export function KoromFullLogo({
  className,
  showSubtitle = true,
}: {
  className?: string;
  showSubtitle?: boolean;
}) {
  return (
    <div className={cn("inline-flex flex-col items-start", className)}>
      <div className="flex items-center gap-2">
        <span className="font-micro text-[28px] font-bold tracking-tight text-[#8067DC] leading-none">
          Korom
        </span>
      </div>
      {showSubtitle && (
        <>
          <div className="my-1 h-[1.5px] w-full bg-[#745DCA]/40" />
          <span className="text-[12px] italic font-medium text-[#745DCA] leading-none tracking-wide">
            Copyrights &amp; Royalties
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Alternative KoRoM (Slide 2 du support de marque)
 */
export function KoromKoRoMLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex flex-col items-start", className)}>
      <div className="flex items-baseline font-micro font-bold text-[#8067DC] leading-none">
        <span className="text-[20px]">Ko</span>
        <span className="text-[20px] ml-0.5">Ro</span>
        <span className="text-[28px] ml-1">M</span>
      </div>
      <div className="my-0.5 h-[1.5px] w-full bg-[#745DCA]/40" />
    </div>
  );
}

/**
 * Alternative KRM (Slide 4 du support de marque)
 */
export function KoromKrmLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex flex-col items-start", className)}>
      <span className="font-micro text-[26px] font-bold italic text-[#8067DC] tracking-wide leading-none">
        KRM
      </span>
      <div className="my-0.5 h-[1.5px] w-full bg-[#745DCA]/40" />
    </div>
  );
}
