import type { GestureEvent, GestureType, NormalizedLandmark } from "../types/vision";

interface GestureState {
  lastGesture: GestureType;
  lastEmitTime: number;
  history: Array<{ gesture: GestureType; confidence: number; timestamp: number }>;
  smoothedPosition: [number, number];
}

export class GestureRecognizer {
  private minConfidence: number;
  private cooldownMs: number;
  private historyWindow: number = 2;
  private handStates: Map<"left" | "right", GestureState> = new Map();

  constructor(minConfidence = 0.60, cooldownMs = 60) {
    this.minConfidence = minConfidence;
    this.cooldownMs = cooldownMs;
  }

  public setMinConfidence(val: number) {
    this.minConfidence = val;
  }

  public setCooldownMs(val: number) {
    this.cooldownMs = val;
  }

  public recognize(
    landmarks: NormalizedLandmark[],
    hand: "left" | "right",
    timestamp: number = performance.now()
  ): GestureEvent {
    if (!landmarks || landmarks.length < 21) {
      return this.createNoneEvent(hand, timestamp);
    }

    const wrist = landmarks[0];
    const palmLength = this.distance(wrist, landmarks[9]);
    const safePalmLength = Math.max(0.01, palmLength);

    const thumbTip = landmarks[4];
    const thumbIP = landmarks[3];
    const thumbMCP = landmarks[2];

    const indexTip = landmarks[8];
    const indexPIP = landmarks[6];
    const indexMCP = landmarks[5];

    const middleTip = landmarks[12];
    const middlePIP = landmarks[10];
    const middleMCP = landmarks[9];

    const ringTip = landmarks[16];
    const ringPIP = landmarks[14];
    const ringMCP = landmarks[13];

    const pinkyTip = landmarks[20];
    const pinkyPIP = landmarks[18];
    const pinkyMCP = landmarks[17];

    const indexTipDist = this.distance(indexTip, wrist) / safePalmLength;
    const indexPipDist = this.distance(indexPIP, wrist) / safePalmLength;

    const middleTipDist = this.distance(middleTip, wrist) / safePalmLength;
    const middlePipDist = this.distance(middlePIP, wrist) / safePalmLength;

    const ringTipDist = this.distance(ringTip, wrist) / safePalmLength;
    const ringPipDist = this.distance(ringPIP, wrist) / safePalmLength;

    const pinkyTipDist = this.distance(pinkyTip, wrist) / safePalmLength;
    const pinkyPipDist = this.distance(pinkyPIP, wrist) / safePalmLength;

    const isIndexExtended = indexTipDist > indexPipDist * 1.15 && indexTip.y < indexMCP.y + 0.05 * safePalmLength;
    const isMiddleExtended = middleTipDist > middlePipDist * 1.15 && middleTip.y < middleMCP.y + 0.05 * safePalmLength;
    const isRingExtended = ringTipDist > ringPipDist * 1.15 && ringTip.y < ringMCP.y + 0.05 * safePalmLength;
    const isPinkyExtended = pinkyTipDist > pinkyPipDist * 1.15 && pinkyTip.y < pinkyMCP.y + 0.05 * safePalmLength;

    const isIndexCurled = indexTipDist < indexPipDist * 1.05 || this.distance(indexTip, indexMCP) < safePalmLength * 0.55;
    const isMiddleCurled = middleTipDist < middlePipDist * 1.05 || this.distance(middleTip, middleMCP) < safePalmLength * 0.55;
    const isRingCurled = ringTipDist < ringPipDist * 1.05 || this.distance(ringTip, ringMCP) < safePalmLength * 0.55;
    const isPinkyCurled = pinkyTipDist < pinkyPipDist * 1.05 || this.distance(pinkyTip, pinkyMCP) < safePalmLength * 0.55;

    const thumbIndexDist = this.distance(thumbTip, indexTip) / safePalmLength;
    const isPinchContact = thumbIndexDist < 0.38;

    const thumbDistToPinkyMCP = this.distance(thumbTip, pinkyMCP) / safePalmLength;
    const isThumbCurled = thumbDistToPinkyMCP < 0.7 || this.distance(thumbTip, middleMCP) < safePalmLength * 0.5;
    const isThumbExtended = !isThumbCurled && this.distance(thumbTip, thumbMCP) > safePalmLength * 0.5;

    const rawPos: [number, number] = [indexTip.x, indexTip.y];

    let state = this.handStates.get(hand);
    if (!state) {
      state = {
        lastGesture: "NONE",
        lastEmitTime: 0,
        history: [],
        smoothedPosition: rawPos,
      };
      this.handStates.set(hand, state);
    }

    const alpha = 0.45;
    const smoothedX = state.smoothedPosition[0] * (1 - alpha) + rawPos[0] * alpha;
    const smoothedY = state.smoothedPosition[1] * (1 - alpha) + rawPos[1] * alpha;
    state.smoothedPosition = [smoothedX, smoothedY];

    let detectedGesture: GestureType = "NONE";
    let confidence = 0.0;

    if (isPinchContact && isMiddleExtended && isRingExtended && isPinkyExtended) {
      detectedGesture = "OK_SIGN";
      confidence = Math.min(0.98, Math.max(0.7, 1.0 - thumbIndexDist));
    } else if (isPinchContact && (!isMiddleExtended || !isRingExtended || !isPinkyExtended)) {
      detectedGesture = "PINCH";
      confidence = Math.min(0.99, Math.max(0.75, 1.0 - thumbIndexDist * 1.2));
    } else if (
      isThumbExtended &&
      thumbTip.y < thumbIP.y &&
      thumbTip.y < wrist.y - 0.2 * safePalmLength &&
      isIndexCurled &&
      isMiddleCurled &&
      isRingCurled &&
      isPinkyCurled
    ) {
      detectedGesture = "THUMBS_UP";
      const verticalAlignment = Math.abs(thumbTip.x - thumbMCP.x) / safePalmLength;
      confidence = Math.min(0.99, Math.max(0.75, 1.0 - verticalAlignment * 0.4));
    } else if (
      thumbTip.y > thumbIP.y &&
      thumbTip.y > wrist.y + 0.1 * safePalmLength &&
      isIndexCurled &&
      isMiddleCurled &&
      isRingCurled &&
      isPinkyCurled
    ) {
      detectedGesture = "THUMBS_DOWN";
      confidence = 0.92;
    } else if (isIndexExtended && isMiddleExtended && isRingCurled && isPinkyCurled) {
      const indexMiddleSpread = this.distance(indexTip, middleTip) / safePalmLength;
      detectedGesture = "PEACE_SIGN";
      confidence = Math.min(0.98, Math.max(0.72, 0.75 + indexMiddleSpread * 0.3));
    } else if (isIndexExtended && isMiddleCurled && isRingCurled && isPinkyCurled) {
      detectedGesture = "POINT";
      confidence = 0.95;
    } else if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled && isThumbCurled) {
      detectedGesture = "FIST";
      confidence = 0.94;
    } else if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended && isThumbExtended) {
      detectedGesture = "OPEN_PALM";
      confidence = 0.97;
    }

    if (confidence < this.minConfidence) {
      detectedGesture = "NONE";
    }

    state.history.push({ gesture: detectedGesture, confidence, timestamp });
    if (state.history.length > this.historyWindow) {
      state.history.shift();
    }

    const counts: Record<string, { count: number; totalConf: number }> = {};
    for (const h of state.history) {
      if (!counts[h.gesture]) counts[h.gesture] = { count: 0, totalConf: 0 };
      counts[h.gesture].count++;
      counts[h.gesture].totalConf += h.confidence;
    }

    let consensusGesture: GestureType = "NONE";
    let consensusConfidence = confidence;
    let maxCount = 0;

    for (const g in counts) {
      if (counts[g].count > maxCount) {
        maxCount = counts[g].count;
        consensusGesture = g as GestureType;
        consensusConfidence = counts[g].totalConf / counts[g].count;
      }
    }

    const isContinuousGesture = ["POINT", "PINCH", "OPEN_PALM"].includes(consensusGesture);
    const hasGestureChanged = consensusGesture !== state.lastGesture;
    const timeSinceLastEmit = timestamp - state.lastEmitTime;

    // Always emit continuous gestures (position tracking). Debounce only discrete ones.
    if (!isContinuousGesture && hasGestureChanged && timeSinceLastEmit < this.cooldownMs) {
      consensusGesture = state.lastGesture;
    } else {
      state.lastGesture = consensusGesture;
      state.lastEmitTime = timestamp;
    }

    const event: GestureEvent = {
      timestamp: Math.round(timestamp),
      source: "hand",
      hand,
      event: consensusGesture,
      confidence: Number(consensusConfidence.toFixed(2)),
      position: [Number(state.smoothedPosition[0].toFixed(4)), Number(state.smoothedPosition[1].toFixed(4))],
      rawLandmarks: landmarks,
    };

    return event;
  }

  private createNoneEvent(hand: "left" | "right", timestamp: number): GestureEvent {
    return {
      timestamp: Math.round(timestamp),
      source: "hand",
      hand,
      event: "NONE",
      confidence: 0,
      position: [0.5, 0.5],
    };
  }

  public reset(hand?: "left" | "right") {
    if (hand) {
      this.handStates.delete(hand);
    } else {
      this.handStates.clear();
    }
  }

  private distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

export const defaultGestureRecognizer = new GestureRecognizer();
