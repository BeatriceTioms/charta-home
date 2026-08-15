"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { buildings, type Building } from "@/lib/data";

type BuildingContextValue = {
  building: Building;
  buildingId: string;
  setBuildingId: (id: string) => void;
};

const BuildingContext = createContext<BuildingContextValue>({
  building: buildings[0],
  buildingId: buildings[0].id,
  setBuildingId: () => {},
});

const STORAGE_KEY = "charta-building";

export function BuildingProvider({ children }: { children: React.ReactNode }) {
  const [buildingId, setId] = useState(buildings[0].id);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && buildings.some((b) => b.id === saved)) setId(saved);
    } catch {
      /* storage unavailable, keep the default building */
    }
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
    <BuildingContext.Provider value={{ building, buildingId: building.id, setBuildingId }}>
      {children}
    </BuildingContext.Provider>
  );
}

export const useBuilding = () => useContext(BuildingContext);
