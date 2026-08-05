"use client";

import { useEffect } from "react";
import {
  addLoopAtPlayhead,
  cycleLoop,
  setLoopA,
  setLoopB,
} from "@/lib/loopEdit";
import { player } from "@/lib/player/controller";
import { useLibrary } from "@/store/library";
import { redoLoopEdit, undoLoopEdit } from "@/store/loopHistory";
import { useUi } from "@/store/ui";

export function ShortcutsProvider() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = ((e.target as HTMLElement)?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (!useLibrary.getState().tracks.length) return;
      const k = e.key;
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+Z undo, +Shift redo; every other combo stays with the browser
        if (k === "z" || k === "Z") {
          e.preventDefault();
          if (e.shiftKey) redoLoopEdit();
          else undoLoopEdit();
        }
        return;
      }
      if (k === " ") {
        e.preventDefault();
        player.togglePlay();
      } else if (k === "l" || k === "L") useUi.getState().toggleLoop();
      else if (k === "a" || k === "A") setLoopA(player.getT());
      else if (k === "b" || k === "B") setLoopB(player.getT());
      else if (k === "ArrowLeft") {
        e.preventDefault();
        player.seekBy(-0.25);
      } else if (k === "ArrowRight") {
        e.preventDefault();
        player.seekBy(0.25);
      } else if (k === "ArrowUp") {
        e.preventDefault();
        player.bumpRate(0.05);
      } else if (k === "ArrowDown") {
        e.preventDefault();
        player.bumpRate(-0.05);
      } else if (k === "<" || (k === "," && e.shiftKey)) player.advance(-1);
      else if (k === ">" || (k === "." && e.shiftKey)) player.advance(1);
      else if (k === "[") {
        e.preventDefault();
        cycleLoop(-1);
      } else if (k === "]") {
        e.preventDefault();
        cycleLoop(1);
      } else if (k === "n" || k === "N") addLoopAtPlayhead();
      else if (k === "r" || k === "R") player.applyRate(1);
      else if (k === "s" || k === "S") useUi.getState().toggleShortcuts();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
