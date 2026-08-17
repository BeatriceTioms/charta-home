"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { Building } from "@/lib/data";

type BuildingContextValue = {
  building: Building;
  buildingId: string;
  setBuildingId: (id: string) => void;
  buildings: Building[];
};

const BuildingContext = createContext<BuildingContextValue | null>(null);

const STORAGE_KEY = "charta-building";

export function BuildingProvider({ children }: { children: React.ReactNode }) {
  const { buildings } = useStore();
  const [buildingId, setId] = useState(buildings[0].id);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && buildings.some((b) => b.id === saved)) setId(saved);
    } catch {
      /* storage unavailable, keep the default building */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setBuildingId = (id: string) => {
    setId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  const building = buildings.find((b) => b.id === buildingId) ?? buildings[0];

  return (
    <BuildingContext.Provider
      value={{ building, buildingId: building.id, setBuildingId, buildings }}
    >
      {children}
    </BuildingContext.Provider>
  );
}

export function useBuilding() {
  const ctx = useContext(BuildingContext);
  if (!ctx) throw new Error("useBuilding must be used inside BuildingProvider");
  return ctx;
}
