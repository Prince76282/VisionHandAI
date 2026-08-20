/**
 * 1-Euro Filter: Adaptive low-pass filter with speed-based cutoff frequency
 * Eliminates tracking jitter while minimizing latency during fast motions.
 */
class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  public filter(val: number, alpha: number): number {
    if (this.y === null) {
      this.s = val;
      this.y = val;
      return val;
    }
    this.s = alpha * val + (1 - alpha) * this.s!;
    this.y = this.s;
    return this.y;
  }

  public lastValue(): number | null {
    return this.y;
  }

  public reset(): void {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilt: LowPassFilter;
  private dxFilt: LowPassFilter;
  private lastTime: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xFilt = new LowPassFilter();
    this.dxFilt = new LowPassFilter();
  }

  private alpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  public filter(val: number, timestamp: number = performance.now()): number {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return this.xFilt.filter(val, 1.0);
    }

    const dt = Math.max(0.001, (timestamp - this.lastTime) / 1000.0);
    this.lastTime = timestamp;
    const rate = 1.0 / dt;

    const prevX = this.xFilt.lastValue() ?? val;
    const dx = (val - prevX) * rate;
    const edx = this.dxFilt.filter(dx, this.alpha(rate, this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);

    return this.xFilt.filter(val, this.alpha(rate, cutoff));
  }

  public reset(): void {
    this.xFilt.reset();
    this.dxFilt.reset();
    this.lastTime = null;
  }
}

export class Point2DFilter {
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;

  constructor(minCutoff = 1.2, beta = 0.008) {
    this.filterX = new OneEuroFilter(minCutoff, beta);
    this.filterY = new OneEuroFilter(minCutoff, beta);
  }

  public filter(x: number, y: number, timestamp: number = performance.now()): [number, number] {
    const smoothX = this.filterX.filter(x, timestamp);
    const smoothY = this.filterY.filter(y, timestamp);
    return [smoothX, smoothY];
  }

  public reset(): void {
    this.filterX.reset();
    this.filterY.reset();
  }
}
