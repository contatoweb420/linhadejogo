import { tick } from "./run";

export function startBlogAgent() {
  const timer = setInterval(() => {
    void tick("agenda").catch(() => undefined);
  }, 60 * 60 * 1000);
  timer.unref?.();
  const starter = setTimeout(() => {
    void tick("agenda").catch(() => undefined);
  }, 60_000);
  starter.unref?.();
}
