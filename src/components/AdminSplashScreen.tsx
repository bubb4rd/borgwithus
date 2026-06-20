type AdminSplashScreenProps = {
  visible: boolean;
};

export default function AdminSplashScreen({ visible }: AdminSplashScreenProps) {
  return (
    <div
      className={`admin-bg fixed inset-0 z-[120] flex items-center justify-center transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!visible}
      aria-live="polite"
    >
      <p className="admin-splash-wordmark text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        borg<span className="text-cyan">with</span>us
      </p>
    </div>
  );
}
