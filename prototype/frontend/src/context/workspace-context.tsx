"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { PublishingEntity, PublishingEntityCreatePayload } from "@/types/api";
import {
  fetchEntities,
  createEntity as apiCreateEntity,
  deleteEntity as apiDeleteEntity,
} from "@/lib/api";

interface WorkspaceContextType {
  entities: PublishingEntity[];
  currentEntity: PublishingEntity | null;
  isLoadingEntities: boolean;
  isGatewayOpen: boolean;
  setIsGatewayOpen: (open: boolean) => void;
  switchEntity: (entityId: string) => void;
  createEntity: (payload: PublishingEntityCreatePayload) => Promise<PublishingEntity>;
  deleteEntity: (entityId: string) => Promise<void>;
  refreshEntities: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [entities, setEntities] = useState<PublishingEntity[]>([]);
  const [currentEntity, setCurrentEntity] = useState<PublishingEntity | null>(null);
  const [isLoadingEntities, setIsLoadingEntities] = useState(true);
  const [isGatewayOpen, setIsGatewayOpen] = useState(false);

  const refreshEntities = useCallback(async () => {
    try {
      const list = await fetchEntities();
      setEntities(list);

      const storedId = typeof window !== "undefined"
        ? localStorage.getItem("korom_active_entity_id")
        : null;

      if (storedId) {
        const found = list.find((e) => e.id === storedId);
        if (found) {
          setCurrentEntity(found);
          return;
        }
      }

      // Si aucun profil n'était mémorisé, proposer l'écran d'accueil Gateway ou prendre le profil par défaut
      const defaultEnt = list.find((e) => e.is_default) || list[0] || null;
      if (defaultEnt) {
        setCurrentEntity(defaultEnt);
        if (typeof window !== "undefined" && !storedId) {
          // Premier accès : on ouvre le Workspace Gateway pour choisir son catalogue
          setIsGatewayOpen(true);
        }
      }
    } catch (err) {
      console.error("Erreur chargement entités éditoriales:", err);
    } finally {
      setIsLoadingEntities(false);
    }
  }, []);

  useEffect(() => {
    refreshEntities();
  }, [refreshEntities]);

  const switchEntity = useCallback((entityId: string) => {
    const found = entities.find((e) => e.id === entityId);
    if (found) {
      setCurrentEntity(found);
      if (typeof window !== "undefined") {
        localStorage.setItem("korom_active_entity_id", found.id);
      }
      setIsGatewayOpen(false);
      // Déclenche le rechargement pour mettre à jour instantanément les vues
      window.dispatchEvent(new Event("korom_entity_changed"));
    }
  }, [entities]);

  const handleCreateEntity = useCallback(async (payload: PublishingEntityCreatePayload): Promise<PublishingEntity> => {
    const created = await apiCreateEntity(payload);
    await refreshEntities();
    switchEntity(created.id);
    return created;
  }, [refreshEntities, switchEntity]);

  const handleDeleteEntity = useCallback(async (entityId: string): Promise<void> => {
    await apiDeleteEntity(entityId);
    const updatedList = await fetchEntities();
    setEntities(updatedList);

    // Si on a supprimé l'entité active, basculer sur l'entité restante par défaut
    if (currentEntity?.id === entityId) {
      const fallback = updatedList.find((e) => e.is_default) || updatedList[0] || null;
      if (fallback) {
        setCurrentEntity(fallback);
        if (typeof window !== "undefined") {
          localStorage.setItem("korom_active_entity_id", fallback.id);
        }
      }
    }
    window.dispatchEvent(new Event("korom_entity_changed"));
  }, [currentEntity]);

  return (
    <WorkspaceContext.Provider
      value={{
        entities,
        currentEntity,
        isLoadingEntities,
        isGatewayOpen,
        setIsGatewayOpen,
        switchEntity,
        createEntity: handleCreateEntity,
        deleteEntity: handleDeleteEntity,
        refreshEntities,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace doit être utilisé au sein d'un WorkspaceProvider");
  }
  return context;
}
