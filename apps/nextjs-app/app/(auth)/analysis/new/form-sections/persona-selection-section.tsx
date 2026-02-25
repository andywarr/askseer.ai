"use client";

import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { FormLabel } from "@/apps/nextjs-app/components/ui/form";
import { X } from "lucide-react";
import {
  PersonaSelect,
  type PersonaStudy,
} from "@/apps/nextjs-app/components/persona/persona-select";
import { listMyPersonas } from "@/apps/nextjs-app/lib/actions/persona-actions";
import { getPersonaImageUrl } from "@/apps/nextjs-app/lib/utils/get-persona-image-url";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";

interface PersonaSelectionSectionProps {
  loading: boolean;
  selectedPersonas: PersonaStudy[];
  onChange: (personas: PersonaStudy[]) => void;
}

export function PersonaSelectionSection({
  loading,
  selectedPersonas,
  onChange,
}: PersonaSelectionSectionProps) {
  const [privatePersonas, setPrivatePersonas] = useState<PersonaStudy[]>([]);
  const [teamPersonas, setTeamPersonas] = useState<PersonaStudy[]>([]);
  const [companyPersonas, setCompanyPersonas] = useState<PersonaStudy[]>([]);
  const [isDefaultTeam, setIsDefaultTeam] = useState(false);
  const [isPersonasLoading, setIsPersonasLoading] = useState(true);

  const [personaSelectId, setPersonaSelectId] = useState<string | null>(null);
  const [personaInputValue, setPersonaInputValue] = useState("");
  const [personaImageUrls, setPersonaImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const result = await listMyPersonas();
        setPrivatePersonas(result.privatePersonas as unknown as PersonaStudy[]);
        setTeamPersonas(result.teamPersonas as unknown as PersonaStudy[]);
        setCompanyPersonas(result.companyPersonas as unknown as PersonaStudy[]);
        setIsDefaultTeam(result.isDefaultTeam || false);
      } catch (error) {
        clientLogger.error("Failed to load personas", { error });
      } finally {
        setIsPersonasLoading(false);
      }
    };
    loadPersonas();
  }, []);

  const handleAddPersona = useCallback(
    (persona: PersonaStudy) => {
      if (selectedPersonas.some((p) => p.id === persona.id)) return;
      onChange([...selectedPersonas, persona]);

      const key = persona.persona?.photoFile?.key;
      if (key) {
        getPersonaImageUrl(key).then((url) => {
          if (url) {
            setPersonaImageUrls((prev) => ({ ...prev, [persona.id]: url }));
          }
        });
      }
      setPersonaSelectId(null);
      setPersonaInputValue("");
    },
    [selectedPersonas, onChange],
  );

  const handleRemovePersona = useCallback(
    (studyId: string) => {
      onChange(selectedPersonas.filter((p) => p.id !== studyId));
    },
    [selectedPersonas, onChange],
  );

  return (
    <div>
      <FormLabel className="mb-2 block">Who is the target user?</FormLabel>

      {/* Selected persona cards */}
      {selectedPersonas.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {selectedPersonas.map((p) => {
            const name = p.persona?.name || p.name || "Unnamed persona";
            const desc = p.persona?.description || "";
            const img = personaImageUrls[p.id] || "";

            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border px-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    {img ? <AvatarImage src={img} alt={name} /> : null}
                    <AvatarFallback>
                      {name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{name}</div>
                    {desc ? (
                      <div className="text-muted-foreground truncate text-xs">
                        {desc}
                      </div>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => handleRemovePersona(p.id)}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Persona picker */}
      {isPersonasLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <PersonaSelect
          privatePersonas={privatePersonas}
          personas={teamPersonas}
          companyPersonas={companyPersonas}
          selectedId={personaSelectId}
          inputValue={personaInputValue}
          onChange={({ selectedId, inputValue, persona }) => {
            setPersonaSelectId(selectedId);
            setPersonaInputValue(inputValue);
            if (persona && selectedId) {
              handleAddPersona(persona);
            }
          }}
          getImageUrl={getPersonaImageUrl}
          placeholder="Search for a persona to add..."
          isDefaultTeam={isDefaultTeam}
          disabled={loading}
        />
      )}
    </div>
  );
}
