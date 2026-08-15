// Brand watermark drawn on top of every property photo.
//
// Sits inside the same `relative` wrapper as the <img> and covers it, so the
// brand name is baked into what the user sees (and into any screenshot they
// take of a listing). pointer-events-none keeps clicks/links working, and
// select-none stops the text being highlighted.

const BRAND = 'RENTORA SKYLINE HOUSING SOLUTIONS';
const SHORT_BRAND = 'RENTORA';

const SIZES = {
  sm: 'text-[9px] sm:text-[10px] tracking-[0.18em]',
  md: 'text-[11px] sm:text-sm tracking-[0.2em]',
  lg: 'text-sm sm:text-lg md:text-xl tracking-[0.22em]',
};

export function ImageWatermark({ size = 'md', short = false, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 flex select-none items-center justify-center ${className}`}
    >
      <span
        className={`px-3 text-center font-semibold uppercase leading-tight text-white/70 [text-shadow:0_1px_6px_rgba(0,0,0,0.55)] ${SIZES[size] || SIZES.md}`}
      >
        {short ? SHORT_BRAND : BRAND}
      </span>
    </div>
  );
}

export default ImageWatermark;
