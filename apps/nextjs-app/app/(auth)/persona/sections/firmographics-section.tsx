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
} from "../persona-form-options";

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
            <span className="font-semibold">Firmographics</span>
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
                  <FormLabel>Employment status</FormLabel>
                  {!customFields.employmentStatus ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employmentStatusOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
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
                        Enter custom value
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder="Enter custom value"
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
                        Use presets
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
                  <FormLabel>Job title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Senior Product Manager"
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
                  <FormLabel>Role seniority</FormLabel>
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
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roleSeniorityOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
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
                        Enter custom value
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder="Enter custom value"
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
                        Use presets
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
                  <FormLabel>Department</FormLabel>
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
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sortedDepartmentOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
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
                        Enter custom value
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder="Enter custom value"
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
                        Use presets
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
                  <FormLabel>Industry</FormLabel>
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
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sortedIndustryOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
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
                        Enter custom value
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder="Enter custom value"
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
                        Use presets
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
                  <FormLabel>Company size</FormLabel>
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
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companySizeOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
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
                        Enter custom value
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder="Enter custom value"
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
                        Use presets
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
                  <FormLabel>Annual Recurring Revenue</FormLabel>
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
                            <SelectValue placeholder="Select range" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {annualRecurringRevenueOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
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
                        Enter custom value
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder="Enter custom value"
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
                        Use presets
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
                  <FormLabel>Decision power</FormLabel>
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
                            <SelectValue placeholder="Select power" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {decisionPowerOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
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
                        Enter custom value
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder="Enter custom value"
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
                        Use presets
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
                  <FormLabel>Budget range</FormLabel>
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
                            <SelectValue placeholder="Select range" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {budgetRangeOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
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
                        Enter custom value
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder="Enter custom value"
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
                        Use presets
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
