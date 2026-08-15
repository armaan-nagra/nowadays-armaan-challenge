"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchParams } from "@/lib/types";
import { WalkIcon, CarIcon, PinIcon } from "./Doodles";

const SCENARIOS: { label: string; params: SearchParams }[] = [
  {
    label: "50 · Times Square · 20 min",
    params: {
      address: "Times Square, New York, NY",
      headcount: 50,
      maxMinutes: 20,
      mode: "walking",
      style: "any",
    },
  },
  {
    label: "30 · Salesforce Tower · 15 min",
    params: {
      address: "415 Mission St, San Francisco, CA 94105",
      headcount: 30,
      maxMinutes: 15,
      mode: "walking",
      style: "any",
    },
  },
  {
    label: "200 · Waikiki happy hour · 15 min",
    params: {
      address: "Hilton Hawaiian Village Waikiki Beach Resort, Honolulu, HI",
      headcount: 200,
      maxMinutes: 15,
      mode: "walking",
      style: "reception",
    },
  },
];

const STYLE_OPTIONS: { value: SearchParams["style"]; label: string }[] = [
  { value: "any", label: "Any style" },
  { value: "seated_dinner", label: "Seated dinner" },
  { value: "reception", label: "Reception" },
];

export function SearchBar({
  onSearch,
  loading,
}: {
  onSearch: (params: SearchParams) => void;
  loading: boolean;
}) {
  const [address, setAddress] = useState("");
  const [headcount, setHeadcount] = useState(30);
  const [maxMinutes, setMaxMinutes] = useState(15);
  const [mode, setMode] = useState<SearchParams["mode"]>("walking");
  const [style, setStyle] = useState<SearchParams["style"]>("any");

  // --- address autocomplete ---
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const suppressFetch = useRef(false);
  const fetchSeq = useRef(0);
  const boxRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    if (suppressFetch.current) {
      suppressFetch.current = false;
      return;
    }
    if (address.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      const seq = ++fetchSeq.current;
      try {
        const res = await fetch("/api/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: address }),
        });
        const json = await res.json();
        if (seq !== fetchSeq.current) return; // a newer request superseded this one
        const s: string[] = json.suggestions ?? [];
        setSuggestions(s);
        setOpen(s.length > 0);
        setActiveIdx(-1);
      } catch {
        // autocomplete is best-effort
      }
    }, 250);
    return () => clearTimeout(t);
  }, [address]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pick = (s: string) => {
    fetchSeq.current++; // invalidate any in-flight autocomplete response
    suppressFetch.current = true;
    setAddress(s);
    setOpen(false);
    setSuggestions([]);
  };

  const submit = (params?: SearchParams) => {
    const p = params ?? { address, headcount, maxMinutes, mode, style };
    if (params) {
      fetchSeq.current++; // don't let a scenario fill re-open the autocomplete
      suppressFetch.current = true;
      setOpen(false);
      setSuggestions([]);
      setAddress(params.address);
      setHeadcount(params.headcount);
      setMaxMinutes(params.maxMinutes);
      setMode(params.mode);
      setStyle(params.style);
    }
    if (!p.address.trim()) return;
    onSearch(p);
  };

  return (
    <div className="sticker p-4 sm:p-5">
      <form
        className="flex flex-col lg:flex-row gap-3 lg:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="flex-1 min-w-0 relative" ref={boxRef}>
          <span className="block font-mono text-[0.68rem] font-bold uppercase tracking-wider text-ink-soft mb-1">
            Near where?
          </span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onKeyDown={(e) => {
              if (!open) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => Math.max(i - 1, -1));
              } else if (e.key === "Enter" && activeIdx >= 0) {
                e.preventDefault();
                pick(suggestions[activeIdx]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Office address, hotel, landmark…"
            className="w-full border border-ink rounded-lg px-3.5 py-2.5 bg-paper text-[0.95rem] focus:outline-none focus:ring-4 focus:ring-sunshine/60 placeholder:text-ink-soft/60"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls="address-suggestions"
            required
          />
          {open && (
            <ul
              id="address-suggestions"
              className="absolute left-0 right-0 top-full mt-2 z-[1050] bg-paper border-[1.5px] border-ink rounded-lg overflow-hidden"
              style={{ boxShadow: "3px 3px 0 0 #22262b" }}
              role="listbox"
            >
              {suggestions.map((s, i) => (
                <li key={s} role="option" aria-selected={i === activeIdx}>
                  <button
                    type="button"
                    className={`w-full text-left px-3.5 py-2.5 text-[0.9rem] flex items-center gap-2 ${
                      i === activeIdx ? "bg-sunshine" : "hover:bg-sunshine/50"
                    } ${i > 0 ? "border-t-2 border-ink/10" : ""}`}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => pick(s)}
                  >
                    <PinIcon className="w-3.5 h-3.5 shrink-0 text-coral" />
                    <span className="truncate">{s}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>

        <label className="w-full lg:w-28">
          <span className="block font-mono text-[0.68rem] font-bold uppercase tracking-wider text-ink-soft mb-1">
            People
          </span>
          <input
            type="number"
            min={1}
            max={2000}
            value={headcount}
            onChange={(e) => setHeadcount(parseInt(e.target.value) || 1)}
            className="w-full border border-ink rounded-lg px-3.5 py-2.5 bg-paper font-mono text-[0.95rem] focus:outline-none focus:ring-4 focus:ring-sunshine/60"
          />
        </label>

        <div className="w-full lg:w-52">
          <span className="block font-mono text-[0.68rem] font-bold uppercase tracking-wider text-ink-soft mb-1">
            Max {mode === "driving" ? "drive" : "walk"}
          </span>
          <div className="flex gap-1.5">
            <select
              value={maxMinutes}
              onChange={(e) => setMaxMinutes(parseInt(e.target.value))}
              className="flex-1 min-w-0 border border-ink rounded-lg px-3 py-2.5 bg-paper font-mono text-[0.9rem] focus:outline-none focus:ring-4 focus:ring-sunshine/60"
              aria-label="Maximum commute minutes"
            >
              {[5, 10, 15, 20, 25, 30].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
            <div className="flex border border-ink rounded-lg overflow-hidden shrink-0" role="radiogroup" aria-label="Commute mode">
              <button
                type="button"
                role="radio"
                aria-checked={mode === "walking"}
                title="Walking"
                onClick={() => setMode("walking")}
                className={`px-2.5 flex items-center ${mode === "walking" ? "bg-sunshine" : "bg-paper hover:bg-cloud"}`}
              >
                <WalkIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "driving"}
                title="Driving"
                onClick={() => setMode("driving")}
                className={`px-2.5 flex items-center border-l border-ink ${mode === "driving" ? "bg-sunshine" : "bg-paper hover:bg-cloud"}`}
              >
                <CarIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <label className="w-full lg:w-44">
          <span className="block font-mono text-[0.68rem] font-bold uppercase tracking-wider text-ink-soft mb-1">
            Vibe
          </span>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as SearchParams["style"])}
            className="w-full border border-ink rounded-lg px-3 py-2.5 bg-paper font-mono text-[0.9rem] focus:outline-none focus:ring-4 focus:ring-sunshine/60"
          >
            {STYLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="btn-cta px-6 py-2.5 text-lg disabled:opacity-60 disabled:cursor-wait shrink-0"
        >
          {loading ? "Scouting…" : "Find tables"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <span className="font-mono text-[0.65rem] uppercase tracking-wider text-ink-soft">
          Try:
        </span>
        {SCENARIOS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => submit(s.params)}
            disabled={loading}
            className="chip hover:bg-sunshine transition-colors cursor-pointer disabled:cursor-wait"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
