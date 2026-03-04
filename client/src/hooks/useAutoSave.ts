/**
 * Auto-save hook with 800ms debounce.
 *
 * Watches `data` for changes and automatically PUTs/POSTs to the given
 * URL after 800ms of inactivity. Returns saving state and last-saved
 * timestamp for UI feedback.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface AutoSaveResult {
  /** True while a save request is in flight. */
  saving: boolean;
  /** Timestamp of the last successful save, or null if never saved. */
  lastSaved: Date | null;
}

const DEBOUNCE_MS = 800;

/**
 * Auto-save data to the given URL with 800ms debounce.
 *
 * @param url    - The API endpoint to PUT data to.
 * @param data   - The payload to save. Changes are detected via JSON serialization.
 * @param enabled - Whether auto-save is active. Set to false to pause.
 */
export function useAutoSave(
  url: string,
  data: unknown,
  enabled: boolean = true,
): AutoSaveResult {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastJsonRef = useRef<string>("");
  const urlRef = useRef(url);
  const enabledRef = useRef(enabled);

  // Keep refs current so the debounced callback always sees latest values
  urlRef.current = url;
  enabledRef.current = enabled;

  const save = useCallback(async (payload: unknown) => {
    if (!enabledRef.current) return;

    setSaving(true);
    try {
      await apiRequest("PUT", urlRef.current, payload);
      setLastSaved(new Date());
    } catch (err) {
      // Silently swallow — the UI can show "saving" indicator.
      // Consumers can layer on explicit error handling via mutations.
      console.warn("[useAutoSave] save failed:", err);
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const json = JSON.stringify(data);

    // Skip if data hasn't changed
    if (json === lastJsonRef.current) return;
    lastJsonRef.current = json;

    // Clear any pending debounce
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Schedule a new save
    timerRef.current = setTimeout(() => {
      save(data);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [data, enabled, save]);

  // Flush on unmount if there is a pending save
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        // Fire the save immediately on unmount so data is not lost
        if (enabledRef.current && lastJsonRef.current) {
          try {
            const payload = JSON.parse(lastJsonRef.current);
            // Fire-and-forget — component is unmounting
            apiRequest("PUT", urlRef.current, payload).catch(() => {});
          } catch {
            // JSON parse failed — nothing to save
          }
        }
      }
    };
  }, []);

  return { saving, lastSaved };
}
