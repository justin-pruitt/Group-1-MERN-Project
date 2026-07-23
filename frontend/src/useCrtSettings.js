import { useState, useEffect } from "react";

function usePersistedToggle(key) {
  const [value, setValue] = useState(
    () => localStorage.getItem(key) === "true"
  );

  useEffect(() => {
    localStorage.setItem(key, value);
  }, [key, value]);

  return [value, setValue];
}

export function useCrtSettings() {
  const [scanlines, setScanlines] = usePersistedToggle("crtScanlines");
  const [bulge, setBulge] = usePersistedToggle("crtBulge");
  return { scanlines, setScanlines, bulge, setBulge };
}