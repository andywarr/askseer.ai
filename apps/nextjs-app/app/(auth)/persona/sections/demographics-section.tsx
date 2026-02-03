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
import { LocationAutocomplete } from "@/apps/nextjs-app/components/location/location-autocomplete";

import {
  ageOptions,
  genderOptions,
  ethnicityOptions,
  educationOptions,
  incomeOptions,
  maritalStatusOptions,
} from "../persona-form-options";

type DemographicsSectionProps = {
  customFields: { [k: string]: boolean };
  onToggleCustomField: (field: string, value: boolean) => void;
};

function DemographicsSectionBase({
  customFields,
  onToggleCustomField,
}: DemographicsSectionProps) {
  const form = useFormContext();

  return (
    <AccordionItem value="demographics">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="font-medium">
            <span className="font-semibold">Demographics</span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
            {/* Age field */}
            <FormField
              control={form.control}
              name="demographics.age"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Age</FormLabel>
                  {!customFields.age ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select range" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ageOptions.map((o) => (
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
                        onClick={() => onToggleCustomField("age", true)}
                      >
                        Enter custom value
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder="Enter custom age or range"
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
                        onClick={() => onToggleCustomField("age", false)}
                      >
                        Use presets
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Gender field */}
            <FormField
              control={form.control}
              name="demographics.gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  {!customFields.gender ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {genderOptions.map((o) => (
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
                        onClick={() => onToggleCustomField("gender", true)}
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
                        onClick={() => onToggleCustomField("gender", false)}
                      >
                        Use presets
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ethnicity field */}
            <FormField
              control={form.control}
              name="demographics.ethnicity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ethnicity</FormLabel>
                  {!customFields.ethnicity ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select ethnicity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ethnicityOptions.map((o) => (
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
                        onClick={() => onToggleCustomField("ethnicity", true)}
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
                        onClick={() => onToggleCustomField("ethnicity", false)}
                      >
                        Use presets
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location field */}
            <FormField
              control={form.control}
              name="demographics.location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <LocationAutocomplete
                      value={field.value || ""}
                      onChange={(val) => field.onChange(val)}
                      placeholder="e.g., San Francisco, CA"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Education field */}
            <FormField
              control={form.control}
              name="demographics.education"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Education</FormLabel>
                  {!customFields.education ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {educationOptions.map((o) => (
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
                        onClick={() => onToggleCustomField("education", true)}
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
                        onClick={() => onToggleCustomField("education", false)}
                      >
                        Use presets
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Income field */}
            <FormField
              control={form.control}
              name="demographics.income"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Income</FormLabel>
                  {!customFields.income ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select range" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {incomeOptions.map((o) => (
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
                        onClick={() => onToggleCustomField("income", true)}
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
                        onClick={() => onToggleCustomField("income", false)}
                      >
                        Use presets
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Marital Status field */}
            <FormField
              control={form.control}
              name="demographics.maritalStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marital status</FormLabel>
                  {!customFields.maritalStatus ? (
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
                          {maritalStatusOptions.map((o) => (
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
                          onToggleCustomField("maritalStatus", true)
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
                          onToggleCustomField("maritalStatus", false)
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

            {/* Household Size field */}
            <FormField
              control={form.control}
              name="demographics.householdSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Household size</FormLabel>
                  {!customFields.householdSize ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["1", "2", "3", "4", "5+"].map((o) => (
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
                          onToggleCustomField("householdSize", true)
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
                          onToggleCustomField("householdSize", false)
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

export const DemographicsSection = memo(DemographicsSectionBase);
DemographicsSection.displayName = "DemographicsSection";
