"use client";

import { memo } from "react";
import { useFormContext } from "react-hook-form";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/apps/nextjs-app/components/ui/accordion";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/apps/nextjs-app/components/ui/form";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/apps/nextjs-app/components/ui/select";
import { ListEditor } from "../list-editor";
import { useTranslations } from "next-intl";

type PsychographicsSectionProps = {
  customFields: { [k: string]: boolean };
  onToggleCustomField: (field: string, value: boolean) => void;
};

function PsychographicsSectionBase({
  customFields,
  onToggleCustomField,
}: PsychographicsSectionProps) {
  const form = useFormContext();
  const tPersona = useTranslations("StudyWizardForms.persona");

  return (
    <AccordionItem value="psychographics">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="font-medium">
            <span className="font-semibold">{tPersona("sections.psychographics")}</span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
            {/* Personality - MBTI-style selector */}
            <FormField
              control={form.control}
              name="psychographics.personality"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>{tPersona("fields.personality")}</FormLabel>
                  {!customFields.personality ? (
                    <div className="flex flex-col gap-2">
                      <div className="text-xs text-zinc-500">
                        {tPersona("fields.mbtiTypePrefix")}{" "}
                        <span className="font-medium text-zinc-700">
                          {(field.value || "").toUpperCase() || "—"}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                        {/* E / I */}
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-500">{tPersona("fields.personalityEnergy")}</span>
                          <Select
                            onValueChange={(v) => {
                              const code = (field.value || "").toUpperCase();
                              const e = v;
                              const s =
                                code[1] && ["S", "N"].includes(code[1])
                                  ? code[1]
                                  : "";
                              const t =
                                code[2] && ["T", "F"].includes(code[2])
                                  ? code[2]
                                  : "";
                              const j =
                                code[3] && ["J", "P"].includes(code[3])
                                  ? code[3]
                                  : "";
                              field.onChange(
                                [e, s, t, j].filter(Boolean).join("")
                              );
                            }}
                            value={
                              (field.value || "").toUpperCase()[0] &&
                              ["E", "I"].includes(
                                (field.value || "").toUpperCase()[0]
                              )
                                ? (field.value as string).toUpperCase()[0]
                                : undefined
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={tPersona("fields.mbtiPlaceholderEnergy")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="E">{tPersona("fields.mbtiE")}</SelectItem>
                              <SelectItem value="I">{tPersona("fields.mbtiI")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {/* S / N */}
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-500">
                            {tPersona("fields.personalityInformation")}
                          </span>
                          <Select
                            onValueChange={(v) => {
                              const code = (field.value || "").toUpperCase();
                              const e =
                                code[0] && ["E", "I"].includes(code[0])
                                  ? code[0]
                                  : "";
                              const s = v;
                              const t =
                                code[2] && ["T", "F"].includes(code[2])
                                  ? code[2]
                                  : "";
                              const j =
                                code[3] && ["J", "P"].includes(code[3])
                                  ? code[3]
                                  : "";
                              field.onChange(
                                [e, s, t, j].filter(Boolean).join("")
                              );
                            }}
                            value={
                              (field.value || "").toUpperCase()[1] &&
                              ["S", "N"].includes(
                                (field.value || "").toUpperCase()[1]
                              )
                                ? (field.value as string).toUpperCase()[1]
                                : undefined
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={tPersona("fields.mbtiPlaceholderInformation")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="S">{tPersona("fields.mbtiS")}</SelectItem>
                              <SelectItem value="N">{tPersona("fields.mbtiN")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {/* T / F */}
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-500">
                            {tPersona("fields.personalityDecisions")}
                          </span>
                          <Select
                            onValueChange={(v) => {
                              const code = (field.value || "").toUpperCase();
                              const e =
                                code[0] && ["E", "I"].includes(code[0])
                                  ? code[0]
                                  : "";
                              const s =
                                code[1] && ["S", "N"].includes(code[1])
                                  ? code[1]
                                  : "";
                              const t = v;
                              const j =
                                code[3] && ["J", "P"].includes(code[3])
                                  ? code[3]
                                  : "";
                              field.onChange(
                                [e, s, t, j].filter(Boolean).join("")
                              );
                            }}
                            value={
                              (field.value || "").toUpperCase()[2] &&
                              ["T", "F"].includes(
                                (field.value || "").toUpperCase()[2]
                              )
                                ? (field.value as string).toUpperCase()[2]
                                : undefined
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={tPersona("fields.mbtiPlaceholderDecisions")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="T">{tPersona("fields.mbtiT")}</SelectItem>
                              <SelectItem value="F">{tPersona("fields.mbtiF")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {/* J / P */}
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-500">
                            {tPersona("fields.personalityStructure")}
                          </span>
                          <Select
                            onValueChange={(v) => {
                              const code = (field.value || "").toUpperCase();
                              const e =
                                code[0] && ["E", "I"].includes(code[0])
                                  ? code[0]
                                  : "";
                              const s =
                                code[1] && ["S", "N"].includes(code[1])
                                  ? code[1]
                                  : "";
                              const t =
                                code[2] && ["T", "F"].includes(code[2])
                                  ? code[2]
                                  : "";
                              const j = v;
                              field.onChange(
                                [e, s, t, j].filter(Boolean).join("")
                              );
                            }}
                            value={
                              (field.value || "").toUpperCase()[3] &&
                              ["J", "P"].includes(
                                (field.value || "").toUpperCase()[3]
                              )
                                ? (field.value as string).toUpperCase()[3]
                                : undefined
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={tPersona("fields.mbtiPlaceholderStructure")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="J">{tPersona("fields.mbtiJ")}</SelectItem>
                              <SelectItem value="P">{tPersona("fields.mbtiP")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="self-start text-zinc-500"
                        onClick={() => onToggleCustomField("personality", true)}
                      >
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.personalityCustomPlaceholder")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        onClick={() =>
                          onToggleCustomField("personality", false)
                        }
                      >
                        {tPersona("fields.useTypeSelector")}
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Interests */}
            <FormField
              control={form.control}
              name="psychographics.interests"
              render={({ field }) => {
                const arr = Array.isArray(field.value) ? field.value : [];
                return (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{tPersona("fields.interests")}</FormLabel>
                    <ListEditor
                      values={arr}
                      onChange={(vals) => field.onChange(vals)}
                      placeholder={tPersona("fields.interestsPlaceholder")}
                    />
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Values */}
            <FormField
              control={form.control}
              name="psychographics.values"
              render={({ field }) => {
                const arr = Array.isArray(field.value) ? field.value : [];
                return (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{tPersona("fields.values")}</FormLabel>
                    <ListEditor
                      values={arr}
                      onChange={(vals) => field.onChange(vals)}
                      placeholder={tPersona("fields.valuesPlaceholder")}
                    />
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Motivations */}
            <FormField
              control={form.control}
              name="psychographics.motivations"
              render={({ field }) => {
                const arr = Array.isArray(field.value) ? field.value : [];
                return (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{tPersona("fields.motivations")}</FormLabel>
                    <ListEditor
                      values={arr}
                      onChange={(vals) => field.onChange(vals)}
                      placeholder={tPersona("fields.motivationsPlaceholder")}
                    />
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Pain Points */}
            <FormField
              control={form.control}
              name="psychographics.painPoints"
              render={({ field }) => {
                const arr = Array.isArray(field.value) ? field.value : [];
                return (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{tPersona("fields.painPoints")}</FormLabel>
                    <ListEditor
                      values={arr}
                      onChange={(vals) => field.onChange(vals)}
                      placeholder={tPersona("fields.painPointsPlaceholder")}
                    />
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export const PsychographicsSection = memo(PsychographicsSectionBase);
PsychographicsSection.displayName = "PsychographicsSection";
