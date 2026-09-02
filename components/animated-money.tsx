"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { formatMoney } from "@/lib/format";

type AnimatedMoneyProps = {
  value: number;
  compact?: boolean;
  className?: string;
  as?: "strong" | "span";
  duration?: number;
  delay?: number;
};

export function AnimatedMoney({ value, compact = false, className, as = "strong", duration = 0.58, delay = 0 }: AnimatedMoneyProps) {
  const reducedMotion = useReducedMotion();
  const amount = useMotionValue(value);
  const formatted = useTransform(amount, (latest) => formatMoney(latest, compact));

  useEffect(() => {
    if (reducedMotion) {
      amount.set(value);
      return;
    }
    const controls = animate(amount, value, { duration, delay, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [amount, delay, duration, reducedMotion, value]);

  return as === "span"
    ? <motion.span className={className}>{formatted}</motion.span>
    : <motion.strong className={className}>{formatted}</motion.strong>;
}

export function AnimatedPercent({ value, className, duration = 0.5 }: { value: number; className?: string; duration?: number }) {
  const reducedMotion = useReducedMotion();
  const percentage = useMotionValue(value);
  const formatted = useTransform(percentage, (latest) => `${Math.round(latest)}%`);

  useEffect(() => {
    if (reducedMotion) {
      percentage.set(value);
      return;
    }
    const controls = animate(percentage, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [duration, percentage, reducedMotion, value]);

  return <motion.strong className={className}>{formatted}</motion.strong>;
}
