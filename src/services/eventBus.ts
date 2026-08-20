import type { GestureEvent } from "../types/vision";

type GestureListener = (event: GestureEvent) => void;

class GestureEventBus {
  private listeners: Set<GestureListener> = new Set();
  private lastEvents: Map<"left" | "right", GestureEvent> = new Map();

  public subscribe(listener: GestureListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emit(event: GestureEvent): void {
    this.lastEvents.set(event.hand, event);
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("Error in gesture event listener:", err);
      }
    });
  }

  public getLastEvent(hand?: "left" | "right"): GestureEvent | undefined {
    if (hand) {
      return this.lastEvents.get(hand);
    }
    const left = this.lastEvents.get("left");
    const right = this.lastEvents.get("right");
    if (!left) return right;
    if (!right) return left;
    return left.timestamp > right.timestamp ? left : right;
  }

  public clear(hand?: "left" | "right"): void {
    if (hand) {
      this.lastEvents.delete(hand);
    } else {
      this.lastEvents.clear();
    }
  }
}

export const gestureBus = new GestureEventBus();
