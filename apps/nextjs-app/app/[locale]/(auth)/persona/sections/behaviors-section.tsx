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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/apps/nextjs-app/components/ui/tabs";

import {
  techProficiencyOptions,
  sortedDeviceOptions,
  sortedChannelOptions,
  sortedPurchaseTriggersOptions,
  sortedConsumerPurchaseTriggersOptions,
  getOptionKey,
} from "../persona-form-options";
import { useTranslations } from "next-intl";

type BehaviorsSectionProps = {
  customFields: { [k: string]: boolean };
  onToggleCustomField: (field: string, value: boolean) => void;
  purchaseContext: "b2b" | "consumer";
  onPurchaseContextChange: (context: "b2b" | "consumer") => void;
};

function BehaviorsSectionBase({
  customFields,
  onToggleCustomField,
  purchaseContext,
  onPurchaseContextChange,
}: BehaviorsSectionProps) {
  const form = useFormContext();
  const tPersona = useTranslations("StudyWizardForms.persona");
  const tOpts = useTranslations("StudyWizardForms.options");

  return (
    <AccordionItem value="behaviors">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="font-medium">
            <span className="font-semibold">{tPersona("sections.behaviors")}</span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
            {/* Tech proficiency */}
            <FormField
              control={form.control}
              name="behaviors.techProficiency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tPersona("fields.techProficiency")}</FormLabel>
                  {!customFields.techProficiency ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.techProficiencyPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {techProficiencyOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("techProficiency." + getOptionKey(o))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        onClick={() =>
                          onToggleCustomField("techProficiency", true)
                        }
                      >
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.techProficiencyCustomPlaceholder")}
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
                          onToggleCustomField("techProficiency", false)
                        }
                      >
                        {tPersona("usePresets")}
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Primary devices */}
            <FormField
              control={form.control}
              name="behaviors.primaryDevices"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tPersona("fields.primaryDevices")}</FormLabel>
                  {!customFields.primaryDevices ? (
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" type="button">
                            {Array.isArray(field.value) && field.value.length > 0
                              ? tPersona("fields.selectedCount", { count: field.value.length })
                              : tPersona("fields.primaryDevicesPlaceholder")}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64">
                          {sortedDeviceOptions.map((dev) => {
                            const current: string[] = Array.isArray(field.value)
                              ? field.value
                              : [];
                            const checked = current.includes(dev);
                            return (
                              <DropdownMenuCheckboxItem
                                key={dev}
                                checked={checked}
                                onSelect={(e) => e.preventDefault()}
                                onCheckedChange={(isChecked) => {
                                  const next = isChecked
                                    ? [...current, dev]
                                    : current.filter((d) => d !== dev);
                                  field.onChange(next);
                                }}
                              >
                                {tOpts("primaryDevices." + getOptionKey(dev))}
                              </DropdownMenuCheckboxItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        onClick={() =>
                          onToggleCustomField("primaryDevices", true)
                        }
                      >
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 md:col-span-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.primaryDevicesCustomPlaceholder")}
                          value={
                            (Array.isArray(field.value)
                              ? (field.value as string[]).join(", ")
                              : (field.value as string)) || ""
                          }
                          onChange={(e) => field.onChange(e.target.value)}
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        onClick={() => {
                          const v = field.value;
                          const arr = Array.isArray(v)
                            ? v
                            : String(v || "")
                                .split(",")
                                .map((s: string) => s.trim())
                                .filter(Boolean);
                          field.onChange(arr);
                          onToggleCustomField("primaryDevices", false);
                        }}
                      >
                        {tPersona("usePresets")}
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preferred channels */}
            <FormField
              control={form.control}
              name="behaviors.preferredChannels"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tPersona("fields.preferredChannels")}</FormLabel>
                  {!customFields.preferredChannels ? (
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" type="button">
                            {Array.isArray(field.value) && field.value.length > 0
                              ? tPersona("fields.selectedCount", { count: field.value.length })
                              : tPersona("fields.preferredChannelsPlaceholder")}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-72">
                          {sortedChannelOptions.map((ch) => {
                            const current: string[] = Array.isArray(field.value)
                              ? field.value
                              : [];
                            const checked = current.includes(ch);
                            return (
                              <DropdownMenuCheckboxItem
                                key={ch}
                                checked={checked}
                                onSelect={(e) => e.preventDefault()}
                                onCheckedChange={(isChecked) => {
                                  const next = isChecked
                                    ? [...current, ch]
                                    : current.filter((c) => c !== ch);
                                  field.onChange(next);
                                }}
                              >
                                {tOpts("preferredChannels." + getOptionKey(ch))}
                              </DropdownMenuCheckboxItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        onClick={() =>
                          onToggleCustomField("preferredChannels", true)
                        }
                      >
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 md:col-span-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.preferredChannelsCustomPlaceholder")}
                          value={
                            (Array.isArray(field.value)
                              ? (field.value as string[]).join(", ")
                              : (field.value as string)) || ""
                          }
                          onChange={(e) => field.onChange(e.target.value)}
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        onClick={() => {
                          const v = field.value;
                          const arr = Array.isArray(v)
                            ? v
                            : String(v || "")
                                .split(",")
                                .map((s: string) => s.trim())
                                .filter(Boolean);
                          field.onChange(arr);
                          onToggleCustomField("preferredChannels", false);
                        }}
                      >
                        {tPersona("usePresets")}
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Purchase triggers */}
            <FormField
              control={form.control}
              name="behaviors.purchaseTriggers"
              render={({ field }) => {
                const triggersOptions =
                  purchaseContext === "b2b"
                    ? sortedPurchaseTriggersOptions
                    : sortedConsumerPurchaseTriggersOptions;
                const optionNamespace =
                  purchaseContext === "b2b"
                    ? "purchaseTriggers"
                    : "consumerPurchaseTriggers";
                return (
                  <FormItem>
                    <FormLabel>{tPersona("fields.purchaseTriggers")}</FormLabel>
                    {!customFields.purchaseTriggers ? (
                      <div className="flex items-center gap-2">
                        <Tabs
                          value={purchaseContext}
                          onValueChange={(value) => {
                            onPurchaseContextChange(value as "b2b" | "consumer");
                            field.onChange([]);
                          }}
                        >
                          <TabsList>
                            <TabsTrigger value="b2b">B2B</TabsTrigger>
                            <TabsTrigger value="consumer">Consumer</TabsTrigger>
                          </TabsList>
                        </Tabs>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" type="button">
                                {Array.isArray(field.value) &&
                                field.value.length > 0
                                  ? tPersona("fields.selectedCount", { count: field.value.length })
                                  : tPersona("fields.purchaseTriggersPlaceholder")}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-72">
                              {triggersOptions.map((tr) => {
                                const current: string[] = Array.isArray(
                                  field.value
                                )
                                  ? field.value
                                  : [];
                                const checked = current.includes(tr);
                                return (
                                  <DropdownMenuCheckboxItem
                                    key={tr}
                                    checked={checked}
                                    onSelect={(e) => e.preventDefault()}
                                    onCheckedChange={(isChecked) => {
                                      const next = isChecked
                                        ? [...current, tr]
                                        : current.filter((t) => t !== tr);
                                      field.onChange(next);
                                    }}
                                  >
                                    {tOpts(`${optionNamespace}.${getOptionKey(tr)}`)}
                                  </DropdownMenuCheckboxItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="text-zinc-500"
                            onClick={() =>
                              onToggleCustomField("purchaseTriggers", true)
                            }
                          >
                            {tPersona("enterCustom")}
                          </Button>
                      </div>

                    ) : (
                      <div className="flex items-center gap-2 md:col-span-2">
                        <FormControl>
                          <Input
                            placeholder={tPersona("fields.purchaseTriggersCustomPlaceholder")}
                            value={
                              (Array.isArray(field.value)
                                ? (field.value as string[]).join(", ")
                                : (field.value as string)) || ""
                            }
                            onChange={(e) => field.onChange(e.target.value)}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="text-zinc-500"
                          onClick={() => {
                            const v = field.value;
                            const arr = Array.isArray(v)
                              ? v
                              : String(v || "")
                                  .split(",")
                                  .map((s: string) => s.trim())
                                  .filter(Boolean);
                            field.onChange(arr);
                            onToggleCustomField("purchaseTriggers", false);
                          }}
                        >
                          {tPersona("usePresets")}
                        </Button>
                      </div>
                    )}
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

export const BehaviorsSection = memo(BehaviorsSectionBase);
BehaviorsSection.displayName = "BehaviorsSection";
