"use client";

import { useCallback, useState } from "react";
import OwnerIntelligence from "@/components/OwnerIntelligence";
import type { OwnershipResult } from "@/lib/types";

/**
 * Client wrapper so the server-rendered profile page can still offer the
 * "Refresh ownership information" action.
 */
export default function OwnershipSection({
  registration,
  initial,
}: {
  registration: string;
  initial: OwnershipResult | null;
}) {
  const [ownership, setOwnership] = useState<OwnershipResult | null>(initial);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(
        `/api/aircraft/${encodeURIComponent(registration)}/ownership/refresh`,
        { method: "POST" },
      );
      if (response.ok) setOwnership(await response.json());
    } catch {
      /* keep the existing result on screen */
    } finally {
      setRefreshing(false);
    }
  }, [registration]);

  return (
    <OwnerIntelligence
      ownership={ownership}
      loading={false}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}
