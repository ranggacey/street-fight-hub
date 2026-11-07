import type { ReactNode } from "react";

/** Panel kaca standar. */
export default function GlassCard({
  children,
  className = "",
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <div className={`${strong ? "glass-strong" : "glass"} p-5 ${className}`}>
      {children}
    </div>
  );
}
