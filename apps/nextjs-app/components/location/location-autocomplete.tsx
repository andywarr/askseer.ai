"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { FormDescription } from "@/apps/nextjs-app/components/ui/form";

export type PlaceResultLite = {
  description: string;
  place_id?: string;
  structured?: {
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    lat?: number;
    lng?: number;
  };
};

export type LocationAutocompleteProps = {
  value: string | undefined;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * Restrict suggestions to these place types.
   * E.g. ["(regions)"] for regions only, ["geocode"] for addresses.
   */
  types?: string[];
  /**
   * Country restrictions, e.g. ["us", "ca"]. Lowercase ISO 3166-1 Alpha-2.
   */
  componentRestrictions?: google.maps.places.ComponentRestrictions;
};

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = "Search a location...",
  className,
  types = ["(regions)"],
  componentRestrictions,
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      // If already initialized, skip
      if (autoRef.current || typeof window === "undefined") return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.warn("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY env var");
        return;
      }

      const loader = new Loader({
        apiKey,
        version: "weekly",
        libraries: ["places"],
      });
      try {
        await loader.load();
        if (cancelled) return;
        const googleObj = (window as unknown as { google: typeof google })
          .google;
        if (inputRef.current) {
          const opts: google.maps.places.AutocompleteOptions = {
            fields: [
              "address_components",
              "geometry",
              "formatted_address",
              "name",
              "place_id",
            ],
            types,
            componentRestrictions,
          };
          autoRef.current = new googleObj.maps.places.Autocomplete(
            inputRef.current,
            opts,
          );
          autoRef.current.addListener("place_changed", () => {
            const place = autoRef.current!.getPlace();
            const formatted =
              place.formatted_address || place.name || value || "";
            onChange(formatted);
          });
          setLoaded(true);
        }
      } catch (e) {
        console.error("Failed to load Google Maps JS API", e);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [onChange, types, componentRestrictions, value]);

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // If Google Places suggestion dropdown (pac-container) is visible,
            // allow Enter so the user can select a suggestion. Otherwise,
            // prevent Enter from submitting the parent form.
            try {
              const pac = document.querySelector(
                ".pac-container",
              ) as HTMLElement | null;
              const pacVisible = !!(
                pac &&
                pac.offsetParent !== null &&
                window.getComputedStyle(pac).display !== "none"
              );
              if (pacVisible) return; // let Google handle selection
            } catch (err) {
              // ignore errors and fall through to prevent submission
            }
            e.preventDefault();
            e.stopPropagation();
          }}
        />
      </div>
      {!loaded && (
        <FormDescription>
          Start typing to search for a location. Powered by Google Places.
        </FormDescription>
      )}
    </div>
  );
}
