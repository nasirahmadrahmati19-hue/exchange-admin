"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase"; // این مسیر درست است چون هر دو در پوشه lib هستند

const channel = typeof window !== "undefined" ? new BroadcastChannel("exchange-app-sync-channel") : null;

export function useSyncedState<T>(key: string, initialValue: T) {
  const latestState = useRef<T>(initialValue);
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        const value = parsed && typeof parsed === "object" && "value" in parsed ? parsed.value : parsed;
        latestState.current = value;
        return value;
      }
      return initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  latestState.current = state;

  useEffect(() => {
    const docRef = doc(db, "synced_states", key);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      if (snapshot.exists()) {
        const fbValue = snapshot.data().value;
        if (fbValue !== undefined && JSON.stringify(latestState.current) !== JSON.stringify(fbValue)) {
          setState(fbValue);
          window.localStorage.setItem(key, JSON.stringify({ value: fbValue }));
        }
      }
    }, (error) => console.error(`[useSyncedState] خطای فایربیس "${key}":`, error));

    return () => { unsubscribe(); };
  }, [key]);

  const setSyncedState = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify({ value: newValue }));
        channel?.postMessage({ key, value: newValue });
        setDoc(doc(db, "synced_states", key), { value: newValue }, { merge: true }).catch(console.error);
      }
      return newValue;
    });
  }, [key]);

  return [state, setSyncedState] as const;
}
