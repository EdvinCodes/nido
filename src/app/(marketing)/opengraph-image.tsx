import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Nido — household finance, shared';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function MarketingOgImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 80,
        background: 'linear-gradient(145deg, #1c1a18 0%, #2a2622 55%, #1c1a18 100%)',
        color: '#fcfcfb',
      }}
    >
      <div
        style={{
          fontSize: 120,
          fontFamily: 'Georgia, serif',
          letterSpacing: '-0.03em',
          marginBottom: 24,
        }}
      >
        nido
      </div>
      <div style={{ fontSize: 36, maxWidth: 720, lineHeight: 1.35, opacity: 0.9 }}>
        Household finance, shared. From one person to the whole home.
      </div>
      <div
        style={{
          marginTop: 48,
          fontSize: 22,
          color: '#e8b84a',
        }}
      >
        Open source · Self-hostable · MIT
      </div>
    </div>,
    { ...size },
  );
}
