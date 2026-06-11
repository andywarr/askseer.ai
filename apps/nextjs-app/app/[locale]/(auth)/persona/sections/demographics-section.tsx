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
  getOptionKey,
} from "../persona-form-options";
import { useTranslations } from "next-intl";

type DemographicsSectionProps = {
  customFields: { [k: string]: boolean };
  onToggleCustomField: (field: string, value: boolean) => void;
};

function DemographicsSectionBase({
  customFields,
  onToggleCustomField,
}: DemographicsSectionProps) {
  const form = useFormContext();
  const tPersona = useTranslations("StudyWizardForms.persona");
  const tOpts = useTranslations("StudyWizardForms.options");

  return (
    <AccordionItem value="demographics">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="font-medium">
            <span className="font-semibold">{tPersona("sections.demographics")}</span>
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
                  <FormLabel>{tPersona("fields.age")}</FormLabel>
                  {!customFields.age ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.agePlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ageOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("age." + getOptionKey(o))}
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
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.ageCustomPlaceholder")}
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
                        {tPersona("usePresets")}
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
                  <FormLabel>{tPersona("fields.gender")}</FormLabel>
                  {!customFields.gender ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.genderPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {genderOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("gender." + getOptionKey(o))}
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
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.genderCustomPlaceholder")}
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
                        {tPersona("usePresets")}
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
                  <FormLabel>{tPersona("fields.ethnicity")}</FormLabel>
                  {!customFields.ethnicity ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.ethnicityPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ethnicityOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("ethnicity." + getOptionKey(o))}
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
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.ethnicityCustomPlaceholder")}
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
                        {tPersona("usePresets")}
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
                  <FormLabel>{tPersona("fields.location")}</FormLabel>
                  <FormControl>
                    <LocationAutocomplete
                      value={field.value || ""}
                      onChange={(val) => field.onChange(val)}
                      placeholder={tPersona("fields.locationPlaceholder")}
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
                  <FormLabel>{tPersona("fields.education")}</FormLabel>
                  {!customFields.education ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.educationPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {educationOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("education." + getOptionKey(o))}
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
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.educationCustomPlaceholder")}
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
                        {tPersona("usePresets")}
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
                  <FormLabel>{tPersona("fields.income")}</FormLabel>
                  {!customFields.income ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.incomePlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {incomeOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("income." + getOptionKey(o))}
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
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.incomeCustomPlaceholder")}
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
                        {tPersona("usePresets")}
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
                  <FormLabel>{tPersona("fields.maritalStatus")}</FormLabel>
                  {!customFields.maritalStatus ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.maritalStatusPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {maritalStatusOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {tOpts("maritalStatus." + getOptionKey(o))}
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
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.maritalStatusCustomPlaceholder")}
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
                        {tPersona("usePresets")}
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
                  <FormLabel>{tPersona("fields.householdSize")}</FormLabel>
                  {!customFields.householdSize ? (
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tPersona("fields.householdSizeSelectPlaceholder")} />
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
                        {tPersona("enterCustom")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={tPersona("fields.householdSizeCustomPlaceholder")}
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

export const DemographicsSection = memo(DemographicsSectionBase);
DemographicsSection.displayName = "DemographicsSection";
