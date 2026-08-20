import { useEffect, useState } from "react";
import type { GestureEvent } from "../types/vision";
import { gestureBus } from "../services/eventBus";

export function useGestureEvents(onEvent?: (event: GestureEvent) => void) {
  const [latestEvent, setLatestEvent] = useState<GestureEvent | null>(null);
  const [activeHands, setActiveHands] = useState<{ left?: GestureEvent; right?: GestureEvent }>({});

  useEffect(() => {
    const unsubscribe = gestureBus.subscribe((event: GestureEvent) => {
      setLatestEvent(event);
      setActiveHands((prev) => ({
        ...prev,
        [event.hand]: event,
      }));

      if (onEvent) {
        onEvent(event);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onEvent]);

  return {
    latestEvent,
    activeHands,
  };
}
