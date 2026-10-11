import { useState, useEffect, useRef } from 'react';
import { validatePincode } from '../data/legalDocs';
import { canonicalStateName } from '../data/indiaStates';

export interface PincodeLookupResult {
  state: string;
  district: string;
}

export interface UsePincodeLookupState {
  suggestion: PincodeLookupResult | null;
  isLoading: boolean;
}

/**
 * Optional helper: usePincodeLookup(pincode)
 *
 * Only when the pincode is valid (^[1-9][0-9]{5}$), tries the public India Post
 * pincode API with a 4-second timeout and returns suggested state and district.
 * On ANY failure (network error, timeout, HTTP failure, invalid response), returns
 * null silently.
 *
 * The registration form must never depend on this lookup.
 */
export function usePincodeLookup(pincode?: string | null): UsePincodeLookupState {
  const [suggestion, setSuggestion] = useState<PincodeLookupResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight lookup
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const trimmed = pincode?.trim() || '';

    // Only attempt when the pincode is strictly valid
    if (!validatePincode(trimmed)) {
      setSuggestion(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 4000); // 4-second timeout requirement

    async function fetchPincodeDetails() {
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${trimmed}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const data = await response.json();

        // Response format: [{ "Status": "Success", "PostOffice": [{ "District": "...", "State": "..." }] }]
        if (
          Array.isArray(data) &&
          data.length > 0 &&
          data[0]?.Status === 'Success' &&
          Array.isArray(data[0]?.PostOffice) &&
          data[0]?.PostOffice.length > 0
        ) {
          const po = data[0].PostOffice[0];
          const rawState = po.State?.trim() || '';
          const rawDistrict = po.District?.trim() || '';

          if (rawState || rawDistrict) {
            const canonicalState = canonicalStateName(rawState) || rawState;
            setSuggestion({
              state: canonicalState,
              district: rawDistrict,
            });
            return;
          }
        }

        // Unsuccessful or empty post office list -> null silently
        setSuggestion(null);
      } catch {
        // Return null silently on any network failure, timeout, or abort
        setSuggestion(null);
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    }

    fetchPincodeDetails();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [pincode]);

  return { suggestion, isLoading };
}
