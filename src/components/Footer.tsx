export default function Footer() {
  return (
    <footer className="border-t border-border px-4 py-10 md:px-8">
      <div className="site-container flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <p className="text-lg font-semibold text-foreground">
          borg<span className="text-cyan">with</span>us
        </p>
        <p className="text-sm text-subtle">
          Please drink responsibly. &copy; {new Date().getFullYear()} borgwithus
        </p>
        <a
          href="https://instagram.com/borgwithus"
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer text-sm text-subtle transition-colors hover:text-cyan"
        >
          @borgwithus
        </a>
      </div>
    </footer>
  );
}
