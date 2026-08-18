"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { Building } from "@/lib/data";

type BuildingContextValue = {
  /** Null only when the agency has no building yet. */
  building: Building | null;
  buildingId: string;
  setBuildingId: (id: string) => void;
  buildings: Building[];
};

const BuildingContext = createContext<BuildingContextValue | null>(null);

const STORAGE_KEY = "charta-building";

export function BuildingProvider({ children }: { children: React.ReactNode }) {
  const { buildings } = useStore();
  // A brand new agency has zero buildings until the owner adds one, so this
  // cannot assume buildings[0] exists.
  const [buildingId, setId] = useState(buildings[0]?.id ?? "");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && buildings.some((b) => b.id === saved)) setId(saved);
    } catch {
      /* storage unavailable, keep the default building */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A building added after the provider mounted (the onboarding flow) should
  // become the selection once it exists, rather than staying on "".
  useEffect(() => {
    if (buildingId || buildings.length === 0) return;
    setId(buildings[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings]);

  const setBuildingId = (id: string) => {
    setId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  const building = buildings.find((b) => b.id === buildingId) ?? buildings[0] ?? null;

  return (
    <BuildingContext.Provider
      value={{ building, buildingId: building?.id ?? "", setBuildingId, buildings }}
    >
      {children}
    </BuildingContext.Provider>
  );
}

/**
 * For the pages under a building (apartments, rent, maintenance...), which
 * cannot render without one. `Shell` never mounts them until a building
 * exists, so the null case here is a programming error, not a real state.
 */
export function useBuilding() {
  const ctx = useContext(BuildingContext);
  if (!ctx) throw new Error("useBuilding must be used inside BuildingProvider");
  if (!ctx.building) {
    throw new Error("useBuilding called with no building; Shell should have shown onboarding");
  }
  return ctx as { building: Building; buildingId: string; setBuildingId: (id: string) => void; buildings: Building[] };
}

/** For chrome that must render either way, such as the sidebar switcher. */
export function useBuildingOptional() {
  const ctx = useContext(BuildingContext);
  if (!ctx) throw new Error("useBuildingOptional must be used inside BuildingProvider");
  return ctx;
}
