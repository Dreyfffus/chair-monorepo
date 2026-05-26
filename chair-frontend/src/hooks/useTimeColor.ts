import { useState, useEffect } from "react";
import { getTimeBgColor } from "../utils/colors";

export function useTimeColor(): string {
  const [color, setColor] = useState(() => getTimeBgColor(new Date()));

  useEffect(() => {
    const id = setInterval(() => setColor(getTimeBgColor(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  return color;
}
