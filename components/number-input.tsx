"use client";

import { InputHTMLAttributes, useEffect, useRef, useState } from "react";

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value?: number;
  onValueChange: (value: number | undefined) => void;
  allowEmpty?: boolean;
};

const displayValue = (value: number | undefined) => value === undefined ? "" : String(value);

export function NumberInput({ value, onValueChange, allowEmpty = false, onBlur, onFocus, ...props }: NumberInputProps) {
  const [draft, setDraft] = useState(displayValue(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(displayValue(value));
  }, [value]);

  return (
    <input
      {...props}
      type="number"
      inputMode={props.inputMode ?? "decimal"}
      value={draft}
      onFocus={(event) => {
        focused.current = true;
        onFocus?.(event);
      }}
      onChange={(event) => {
        const next = event.target.value.replace(/^(-?)0+(?=\d)/, "$1");
        setDraft(next);
        if (next === "" || next === "-" || next === "." || next === "-.") return;
        const parsed = Number(next);
        if (Number.isFinite(parsed)) onValueChange(parsed);
      }}
      onBlur={(event) => {
        focused.current = false;
        if (draft === "" || draft === "-" || draft === "." || draft === "-.") {
          if (allowEmpty) onValueChange(undefined);
          else setDraft(displayValue(value));
        } else {
          setDraft(displayValue(Number(draft)));
        }
        onBlur?.(event);
      }}
    />
  );
}
