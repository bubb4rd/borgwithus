export const ADMIN_SPLASH_MIN_MS = 550;
export const ADMIN_SPLASH_MAX_MS = 1800;

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export async function runWithAdminSplashTiming<T>(task: () => Promise<T>) {
  const work = task();
  await Promise.race([
    Promise.all([work, sleep(ADMIN_SPLASH_MIN_MS)]),
    sleep(ADMIN_SPLASH_MAX_MS),
  ]);
  return work;
}
