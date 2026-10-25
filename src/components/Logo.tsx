// Keystone mark: the wedge that locks an arch, in navy with a saddle keystone.
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path d="M17 8h14l-3 14h-8z" fill="var(--saddle)" />
      <path
        d="M6 40V28a18 18 0 0 1 10-16l3 12a6 6 0 0 0-3 5v11zM42 40V28a18 18 0 0 0-10-16l-3 12a6 6 0 0 1 3 5v11z"
        fill="var(--accent)"
      />
    </svg>
  );
}
