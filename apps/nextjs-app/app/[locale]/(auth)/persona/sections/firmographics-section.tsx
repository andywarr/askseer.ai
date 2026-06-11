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
  employmentStatusOptions,
  roleSeniorityOptions,
  sortedDepartmentOptions,
  sortedIndustryOptions,
  companySizeOptions,
  decisionPowerOptions,
  budgetRangeOptions,
  annualRecurringRevenueOptions,
  nonEmployedStatuses,
  getOptionKey,
} from "../persona-form-options";
import { useTranslations } from "next-intl";

type FirmographicsSectionProps = {
  customFields: { [k: string]: boolean };
  onToggleCustomField: (field: string, value: boolean) => void;
  /** Current employment status value - passed from parent to avoid duplicate form.watch() calls */
  employmentStatus: string | undefined;
  /** Current decision power value - passed from parent to avoid duplicate form.watch() calls */
  decisionPower: string | undefined;
};

function FirmographicsSectionBase({
  customFields,
  onToggleCustomField,
  employmentStatus,
  decisionPower,
}: FirmographicsSectionProps) {
  const form = useFormContext();
  const tPersona = useTranslations("StudyWizardForms.persona");
  const tOpts = useTranslations("StudyWizardForms.options");

  // Compute disabled states once at the top level
  const isNonEmployed = nonEmployedStatuses.includes(
    (employmentStatus as (typeof nonEmployedStatuses)[number]) || ""
  );
  const isBudgetDisabled = isNonEmployed || decisionPower === "No influence";

  return (
    <AccordionItem value="firmographics">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="font-medium">
            <span className="font-semibold">{tPersona("sections.firmographics")}</span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
            {/* Employment status */}
            <FormField
              control={form.control}
              name="firmographics.employmentStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tPersona("fields.employmentStatus")}</FormLabel>
                  {!customFields.employmentStatus ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.employmentStatusPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employmentStatusOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("employmentStatus." + getOptionKey(o))}
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
                           onToggleCustomField("employmentStatus", true)
                        }
                      >
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.employmentStatusCustomPlaceholder")}
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
                          onToggleCustomField("employmentStatus", false)
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

            {/* Job title */}
            <FormField
              control={form.control}
              name="firmographics.jobTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tPersona("fields.jobTitle")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={tPersona("fields.jobTitlePlaceholder")}
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={isNonEmployed}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Role seniority */}
            <FormField
              control={form.control}
              name="firmographics.roleSeniority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tPersona("fields.roleSeniority")}</FormLabel>
                  {!customFields.roleSeniority ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                        disabled={isNonEmployed}
                        key={`roleSeniority-${isNonEmployed ? "disabled" : "enabled"}-${field.value || "empty"}`}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.roleSeniorityPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roleSeniorityOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("roleSeniority." + getOptionKey(o))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isNonEmployed}
                        onClick={() =>
                          onToggleCustomField("roleSeniority", true)
                        }
                      >
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.roleSeniorityCustomPlaceholder")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={isNonEmployed}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isNonEmployed}
                        onClick={() =>
                          onToggleCustomField("roleSeniority", false)
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

            {/* Department */}
            <FormField
              control={form.control}
              name="firmographics.department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tPersona("fields.department")}</FormLabel>
                  {!customFields.department ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                        disabled={isNonEmployed}
                        key={`department-${isNonEmployed ? "disabled" : "enabled"}-${field.value || "empty"}`}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.departmentPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sortedDepartmentOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("department." + getOptionKey(o))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isNonEmployed}
                        onClick={() => onToggleCustomField("department", true)}
                      >
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.departmentCustomPlaceholder")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={isNonEmployed}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isNonEmployed}
                        onClick={() => onToggleCustomField("department", false)}
                      >
                        {tPersona("usePresets")}
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Industry */}
            <FormField
              control={form.control}
              name="firmographics.industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tPersona("fields.industry")}</FormLabel>
                  {!customFields.industry ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                        disabled={isNonEmployed}
                        key={`industry-${isNonEmployed ? "disabled" : "enabled"}-${field.value || "empty"}`}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.industryPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sortedIndustryOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("industry." + getOptionKey(o))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isNonEmployed}
                        onClick={() => onToggleCustomField("industry", true)}
                      >
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.industryCustomPlaceholder")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={isNonEmployed}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isNonEmployed}
                        onClick={() => onToggleCustomField("industry", false)}
                      >
                        {tPersona("usePresets")}
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Company size */}
            <FormField
              control={form.control}
              name="firmographics.companySize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tPersona("fields.companySize")}</FormLabel>
                  {!customFields.companySize ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                        disabled={isNonEmployed}
                        key={`companySize-${isNonEmployed ? "disabled" : "enabled"}-${field.value || "empty"}`}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.companySizePlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companySizeOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("companySize." + getOptionKey(o))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isNonEmployed}
                        onClick={() => onToggleCustomField("companySize", true)}
                      >
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.companySizeCustomPlaceholder")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={isNonEmployed}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isNonEmployed}
                        onClick={() =>
                          onToggleCustomField("companySize", false)
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

            {/* Annual Recurring Revenue */}
            <FormField
              control={form.control}
              name="firmographics.annualRecurringRevenue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tPersona("fields.annualRecurringRevenue")}</FormLabel>
                  {!customFields.annualRecurringRevenue ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                        disabled={isNonEmployed}
                        key={`arr-${isNonEmployed ? "disabled" : "enabled"}-${field.value || "empty"}`}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.annualRecurringRevenuePlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {annualRecurringRevenueOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("annualRecurringRevenue." + getOptionKey(o))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isNonEmployed}
                        onClick={() =>
                          onToggleCustomField("annualRecurringRevenue", true)
                        }
                      >
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.annualRecurringRevenueCustomPlaceholder")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={isNonEmployed}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isNonEmployed}
                        onClick={() =>
                          onToggleCustomField("annualRecurringRevenue", false)
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

            {/* Decision power */}
            <FormField
              control={form.control}
              name="firmographics.decisionPower"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tPersona("fields.decisionPower")}</FormLabel>
                  {!customFields.decisionPower ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                        disabled={isNonEmployed}
                        key={`decisionPower-${isNonEmployed ? "disabled" : "enabled"}-${field.value || "empty"}`}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.decisionPowerPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {decisionPowerOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("decisionPower." + getOptionKey(o))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isNonEmployed}
                        onClick={() =>
                          onToggleCustomField("decisionPower", true)
                        }
                      >
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.decisionPowerCustomPlaceholder")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={isNonEmployed}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isNonEmployed}
                        onClick={() =>
                          onToggleCustomField("decisionPower", false)
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

            {/* Budget range */}
            <FormField
              control={form.control}
              name="firmographics.budgetRange"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tPersona("fields.budgetRange")}</FormLabel>
                  {!customFields.budgetRange ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                        disabled={isBudgetDisabled}
                        key={`budgetRange-${isBudgetDisabled ? "disabled" : "enabled"}-${field.value || "empty"}`}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.budgetRangePlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {budgetRangeOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("budgetRange." + getOptionKey(o))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isBudgetDisabled}
                        onClick={() => onToggleCustomField("budgetRange", true)}
                      >
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.budgetRangeCustomPlaceholder")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={isBudgetDisabled}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-zinc-500"
                        disabled={isBudgetDisabled}
                        onClick={() =>
                          onToggleCustomField("budgetRange", false)
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
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export const FirmographicsSection = memo(FirmographicsSectionBase);
FirmographicsSection.displayName = "FirmographicsSection";
