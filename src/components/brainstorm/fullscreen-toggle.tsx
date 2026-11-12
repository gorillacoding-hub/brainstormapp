import { Maximize, Minimize } from "lucide-react";
import { useFullscreen } from "@/lib/fullscreen";

export function FullscreenToggle() {
  const { on, toggle } = useFullscreen();
  const label = on ? "Exit full view" : "Enter full view";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className="panel absolute right-3 top-16 z-30 flex size-11 items-center justify-center text-ink"
    >
      {on ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />}
    </button>
  );
}
