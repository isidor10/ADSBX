"use client";

import { usePathname } from "next/navigation";

/**
 * Okvir aplikacije.
 *
 * Panel izvora postoji samo na strani razgovora, pa samo tamo grid rezerviše
 * treću kolonu — inače bi se sadržaj ostalih strana bespotrebno sabijao u
 * uzak stubac.
 */
export function Ljuska({ children }: { children: React.ReactNode }) {
  const putanja = usePathname();
  const saPanelom = putanja === "/";

  return (
    <div className={`ljuska ${saPanelom ? "ljuska-sa-panelom" : ""}`}>
      {children}
    </div>
  );
}
