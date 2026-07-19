export function SkylineLogo({ size = 'md', mono = false }) {
  const dim = size === 'sm' ? { h: 22, gap: '10px', t: 'text-[15px]', s: 'text-[9px]' }
            : size === 'lg' ? { h: 34, gap: '14px', t: 'text-xl', s: 'text-[11px]' }
            : { h: 26, gap: '12px', t: 'text-lg', s: 'text-[10px]' };
  return (
    <div className="flex items-center" style={{ gap: dim.gap }}>
      <div className="skyline-mark" style={{ height: dim.h }}>
        <span /><span /><span /><span />
      </div>
      <div className={`leading-none font-display font-extrabold tracking-tight ${mono ? 'text-white' : 'text-foreground'}`}>
        <div className={dim.t}>SKYLINE</div>
        <div className={`${dim.s} tracking-[0.35em] font-semibold ${mono ? 'text-white/70' : 'text-muted-foreground'} mt-[2px]`}>MODULAR</div>
      </div>
    </div>
  );
}
export default SkylineLogo;
