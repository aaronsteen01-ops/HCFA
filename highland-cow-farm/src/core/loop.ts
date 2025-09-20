type UpdateFn = (dt: number) => void;

let rafId: number | null = null;
let lastTime = 0;
let running = false;
let updateFn: UpdateFn | null = null;

function step(timestamp: number) {
  if (!running || !updateFn) return;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;
  updateFn(dt);
  rafId = requestAnimationFrame(step);
}

export function startLoop(fn: UpdateFn): void {
  updateFn = fn;
  if (!running) {
    running = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(step);
  }
}

export function stopLoop(): void {
  running = false;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  updateFn = null;
}

export function isRunning(): boolean {
  return running;
}
