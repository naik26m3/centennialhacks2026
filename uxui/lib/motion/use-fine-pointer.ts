"use client";

import { useSyncExternalStore } from "react";

// Whether the primary input is a precise pointer (mouse/trackpad) rather
// than touch — pointer-driven parallax and other desktop-only flourishes
// gate on this (spec §6/§39: disable on touch devices).
const QUERY = "(pointer: fine)";

function subscribe(listener: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
