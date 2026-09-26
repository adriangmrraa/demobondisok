function shadeHex(hex: string, factor: number): string {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  const mix = (channel: number) => Math.round(
    factor >= 0 ? channel + (255 - channel) * factor : channel * (1 + factor),
  );
  return `#${channels.map((channel) => mix(channel).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * La flota es BLANCO PLATEADO de flota real (perlado frío, degradado
 * metálico) y la identidad de línea vive en la franja distintiva, como
 * los urbanos del AMBA.
 */

export function lightenHex(hex: string, factor = 0.45): string {
  return shadeHex(hex, factor);
}

export function busBadgeSvg(color: string, shortName: string): string {
  const border = shadeHex(color, -0.28);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
    <circle cx="48" cy="50" r="32" fill="#0B1220" opacity=".2"/>
    <circle cx="48" cy="47" r="33" fill="${color}" stroke="#FFFFFF" stroke-width="5"/>
    <circle cx="48" cy="47" r="27" fill="none" stroke="${border}" stroke-opacity=".28" stroke-width="2"/>
    <rect x="26" y="32" width="44" height="30" rx="11" fill="#FFFFFF"/>
    <text x="48" y="54" text-anchor="middle" fill="#101D3D" font-family="Arial,Helvetica,sans-serif" font-size="23" font-weight="800" letter-spacing="-.8">${shortName}</text>
  </svg>`;
}

export function busHeadingSvg(color: string): string {
  const edge = shadeHex(color, -0.32);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
    <path d="M48 4 63 25 54 28 48 23 42 28 33 25Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round"/>
    <path d="M48 6 61 24 53 26 48 21 43 26 35 24Z" fill="${color}" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}

/**
 * Colectivo cenital — flota BLANCO PLATEADO vista desde arriba. Frente =
 * arriba. Carrocería perlada fría, contorno oscuro fino, cristal black
 * silver en dos hojas con pilar, cartel ámbar, techo gris plateado con
 * nervios finos, faldón negro con highlight y franjas laterales del
 * COLOR DE LÍNEA como distintivo.
 */
export function busTopDownSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
    <g fill="#0D1420">
      <rect x="23.5" y="22" width="6.5" height="15" rx="3"/>
      <rect x="66" y="22" width="6.5" height="15" rx="3"/>
      <rect x="23.5" y="61" width="6.5" height="14" rx="3"/>
      <rect x="66" y="61" width="6.5" height="14" rx="3"/>
    </g>
    <rect x="23" y="9" width="3" height="2.2" rx="1" fill="#0D1420" transform="rotate(-14 24.5 10)"/>
    <rect x="70" y="9" width="3" height="2.2" rx="1" fill="#0D1420" transform="rotate(14 71.5 10)"/>
    <rect x="27" y="9" width="42" height="78" rx="13" fill="#E6E8EC" stroke="#0D1420" stroke-width="1.6"/>
    <rect x="28.5" y="31" width="2.2" height="46" fill="${color}"/>
    <rect x="65.3" y="31" width="2.2" height="46" fill="${color}"/>
    <path d="M29.5 15.5Q38.5 11.5 46.4 14.5L46.4 28 29.5 28Z" fill="#13171D"/>
    <path d="M66.5 15.5Q57.5 11.5 49.6 14.5L49.6 28 66.5 28Z" fill="#13171D"/>
    <rect x="46.9" y="13.2" width="2.2" height="14.8" fill="#1C222A"/>
    <path d="M32 25 43.5 17.5" stroke="#D7DCE2" stroke-opacity=".35" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M52 17.5 63.5 25" stroke="#D7DCE2" stroke-opacity=".35" stroke-width="1.2" stroke-linecap="round"/>
    <rect x="33" y="31.5" width="30" height="6" rx="2" fill="#F7C84B"/>
    <rect x="32" y="39" width="32" height="37" rx="6" fill="#DFE1E5"/>
    <path d="M37 41V74M48 41V74M59 41V74" stroke="#B9BDC4" stroke-opacity=".55" stroke-width="1.1"/>
    <rect x="29" y="76" width="38" height="9" rx="4" fill="#0A0E16"/>
    <path d="M30 76.8H66" stroke="#FFFFFF" stroke-opacity=".16" stroke-width=".8"/>
    <circle cx="32.5" cy="11.8" r="1.6" fill="#FFF2B5"/>
    <circle cx="63.5" cy="11.8" r="1.6" fill="#FFF2B5"/>
    <rect x="33" y="84" width="7" height="2.5" rx="1.2" fill="#E5484D"/>
    <rect x="56" y="84" width="7" height="2.5" rx="1.2" fill="#E5484D"/>
  </svg>`;
}

/**
 * Ómnibus isométrico 3/4 — flota BLANCO PLATEADO (billboard relativo a
 * cámara). Tipo D flat-nose LARGO y ALTO (volumen de urbano real:
 * lateral de 34px sobre largo aparente 2.6:1, techo profundo, ruedas
 * grandes), proyección idéntica a la del cenital: techo + lateral
 * izquierdo + frontal, frente hacia +x.
 *
 * - Carrocería perlada fría de flota real con degradado metálico y
 *   brillos especulares en los hombros.
 * - Identidad de línea: FRANJA del color de línea que cruza el lateral
 *   y rodea el frente como cinta fina (distintivo), como los urbanos
 *   del AMBA.
 * - Cristal black silver continuo (sheen plateado) con seams sutiles,
 *   UN streak principal y reflejo de horizonte, faldón negro con
 *   highlight 1px, contorno oscuro fino #0D1420.
 * - Espejos en montante A: lejano (asoma por la silueta) + cercano.
 * - Cartel ámbar de destino: DISTINTIVO conservado.
 * - steer: −1 | 0 | 1 → eje delantero paramétrico (rig de esquinas).
 *
 * ViewBox 178×90 con el CUERPO centrado en el canvas (el billboard rota
 * por el centro): cuerpo x 13..165 (centro 89 = 178/2), contenido y
 * 2..88 (centro 45 = 90/2).
 */
export function busIsoSvg(color: string, steer: -1 | 0 | 1 = 0, flip = false): string {
  const front = '#D6DAE0';
  const roof = '#DCDEE2';
  const ribs = '#B8BCC3';
  const doorFill = '#E6E8EC';

  // Proyección de la cara frontal: arista superior D(121,51)→C(165,29).
  const fn = { x: 0.4472, y: 0.8944 };
  const fp = (t: number, off: number): [number, number] => [
    Math.round((121 + 44 * t + fn.x * off) * 10) / 10,
    Math.round((51 - 22 * t + fn.y * off) * 10) / 10,
  ];
  const quad = (pts: [number, number][]): string =>
    `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`;

  const cartel = quad([fp(0.1, 1), fp(0.9, 1), fp(0.9, 4.5), fp(0.1, 4.5)]);
  const windshield = quad([fp(0.1, 5.5), fp(0.8, 5.5), fp(0.8, 19), fp(0.1, 19)]);
  const pillarTop = fp(0.5, 5.5);
  const pillarBottom = fp(0.5, 19);
  const grille = quad([fp(0.1, 20.5), fp(0.74, 20.5), fp(0.74, 25.5), fp(0.1, 25.5)]);
  const frontSkirt = quad([fp(0.02, 29.2), fp(0.68, 29.2), fp(0.68, 30.35), fp(0.02, 30.35)]);
  const streakF1 = fp(0.14, 16);
  const streakF2 = fp(0.42, 7.5);
  const streakH1 = fp(0.58, 16);
  const streakH2 = fp(0.74, 10);

  // Cara lateral: arista superior A(13,24)→D(121,51), pendiente 0.25.
  const syTop = (x: number) => 24 + (x - 13) * 0.25;
  const sq = (x1: number, x2: number, o1: number, o2: number): string =>
    `M${x1} ${Math.round((syTop(x1) + o1) * 10) / 10}L${x2} ${Math.round((syTop(x2) + o1) * 10) / 10}L${x2} ${Math.round((syTop(x2) + o2) * 10) / 10}L${x1} ${Math.round((syTop(x1) + o2) * 10) / 10}Z`;

  const glassBand = sq(20, 97, 5, 19.5);
  const doorPatch = sq(100, 115, 4, 27.4);
  const doorGlass = sq(102, 113, 5.5, 19);
  const lineStripe = sq(15, 119.5, 20.5, 25.5);
  const frontStripe = quad([fp(0.08, 19.4), fp(0.78, 19.4), fp(0.78, 20.4), fp(0.08, 20.4)]);

  // Rig del eje delantero: al estar espejado, invertimos el signo del steer
  const effectiveSteer = flip ? ((steer === 0 ? 0 : -steer) as -1 | 0 | 1) : steer;
  const flX = 96 + effectiveSteer * 1.6;
  const flRot = -13 + effectiveSteer * 11;
  const frX = 137 + effectiveSteer * 1;
  const frRot = 16 + effectiveSteer * 9;

  const bodyGradId = flip ? 'iso-body-flip' : 'iso-body';
  const glassGradId = flip ? 'iso-glass-flip' : 'iso-glass';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 178 90" width="178" height="90">
    <defs>
      <linearGradient id="${bodyGradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#F4F5F7"/>
        <stop offset=".38" stop-color="#E2E4E8"/>
        <stop offset="1" stop-color="#C6CAD1"/>
      </linearGradient>
      <linearGradient id="${glassGradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#343A42"/>
        <stop offset=".45" stop-color="#1C2127"/>
        <stop offset="1" stop-color="#0C1015"/>
      </linearGradient>
    </defs>
    <g ${flip ? 'transform="translate(178, 0) scale(-1, 1)"' : ''}>
    <path d="M13 24 55 2 165 29 121 51Z" fill="${roof}" stroke="#0D1420" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M13 24 121 51 121 85 13 58Z" fill="url(#${bodyGradId})" stroke="#0D1420" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M121 51 165 29 165 63 121 85Z" fill="${front}" stroke="#0D1420" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M32.9 19.7 127.9 43.5M43.4 14.5 138.4 38.2M54 9.2 149 32.9" stroke="${ribs}" stroke-opacity=".3" stroke-width="1"/>
    <path d="M121 51 165 29" stroke="#FFFFFF" stroke-opacity=".4" stroke-width="1.2"/>
    <path d="M13 24 121 51" stroke="#FFFFFF" stroke-opacity=".26" stroke-width="1.1"/>
    <path d="M55 2 165 29" stroke="#FFFFFF" stroke-opacity=".18" stroke-width="1"/>
    <path d="M14 52.25 120 78.75 120 84.75 14 58.25Z" fill="#0A0E16"/>
    <path d="M14.6 52.35 119.4 78.85" stroke="#FFFFFF" stroke-opacity=".16" stroke-width=".8"/>
    <path d="M${glassBand.slice(1)}" fill="url(#${glassGradId})" stroke="#0D1420" stroke-width="1"/>
    <path d="M33 ${Math.round((syTop(33) + 5.5) * 10) / 10}V${Math.round((syTop(33) + 19) * 10) / 10}M48 ${Math.round((syTop(48) + 5.5) * 10) / 10}V${Math.round((syTop(48) + 19) * 10) / 10}M63 ${Math.round((syTop(63) + 5.5) * 10) / 10}V${Math.round((syTop(63) + 19) * 10) / 10}M79 ${Math.round((syTop(79) + 5.5) * 10) / 10}V${Math.round((syTop(79) + 19) * 10) / 10}" stroke="#0D1420" stroke-opacity=".55" stroke-width="1.1"/>
    <path d="M24 ${Math.round((syTop(24) + 18) * 10) / 10}L44 ${Math.round((syTop(44) + 9.5) * 10) / 10}" stroke="#D7DCE2" stroke-opacity=".32" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M${doorPatch.slice(1)}" fill="${doorFill}" stroke="#0D1420" stroke-opacity=".6" stroke-width="1"/>
    <path d="M${lineStripe.slice(1)}" fill="${color}"/>
    <path d="M${doorGlass.slice(1)}" fill="url(#${glassGradId})" stroke="#0D1420" stroke-opacity=".7" stroke-width=".9"/>
    <path d="M${cartel.slice(1)}" fill="#F7C84B" stroke="#C89A2A" stroke-width=".8"/>
    <path d="M${windshield.slice(1)}" fill="url(#${glassGradId})" stroke="#0D1420" stroke-width="1"/>
    <path d="M${frontStripe.slice(1)}" fill="${color}"/>
    <path d="M${pillarTop[0]} ${pillarTop[1]}L${pillarBottom[0]} ${pillarBottom[1]}" stroke="#060A12" stroke-opacity=".8" stroke-width="2"/>
    <path d="M${streakF1[0]} ${streakF1[1]}L${streakF2[0]} ${streakF2[1]}" stroke="#D7DCE2" stroke-opacity=".4" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M${streakH1[0]} ${streakH1[1]}L${streakH2[0]} ${streakH2[1]}" stroke="#9AA1A9" stroke-opacity=".22" stroke-width="1" stroke-linecap="round"/>
    <path d="M${grille.slice(1)}" fill="#0A0E16" stroke="#0D1420" stroke-width=".8"/>
    <path d="M${quad([fp(0.22, 22.5), fp(0.3, 22.5), fp(0.3, 24), fp(0.22, 24)]).slice(1)}" fill="#1E2836"/>
    <path d="M${quad([fp(0.44, 22.5), fp(0.52, 22.5), fp(0.52, 24), fp(0.44, 24)]).slice(1)}" fill="#1E2836"/>
    <path d="M${quad([fp(0.66, 22.5), fp(0.74, 22.5), fp(0.74, 24), fp(0.66, 24)]).slice(1)}" fill="#1E2836"/>
    <circle cx="${fp(0.18, 24)[0]}" cy="${fp(0.18, 24)[1]}" r="2.1" fill="#FFF2B5"/>
    <circle cx="${fp(0.66, 24)[0]}" cy="${fp(0.66, 24)[1]}" r="2.1" fill="#FFF2B5"/>
    <path d="M${frontSkirt.slice(1)}" fill="#0A0E16"/>
    <path d="M13.6 51.5 14.4 53.4" stroke="#E5484D" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M163 32.5 173 27.5" stroke="#0D1420" stroke-width="1.8" stroke-linecap="round"/>
    <rect x="169.2" y="23.6" width="5" height="2.6" rx="1.2" fill="#0D1420" transform="rotate(-24 171.7 24.9)"/>
    <path d="M169.6 23.8 173.4 26.2" stroke="#FFFFFF" stroke-opacity=".3" stroke-width=".7" stroke-linecap="round"/>
    <path d="M122 54 131 58.8" stroke="#0D1420" stroke-width="1.8" stroke-linecap="round"/>
    <rect x="129.6" y="58.9" width="4.6" height="2.5" rx="1.1" fill="#0D1420" transform="rotate(22 131.9 60.1)"/>
    <path d="M130 59.2 133.4 60.9" stroke="#FFFFFF" stroke-opacity=".3" stroke-width=".7" stroke-linecap="round"/>
    <ellipse cx="26" cy="61.3" rx="6.2" ry="9.5" fill="#0D1420" transform="rotate(-13 26 61.3)"/>
    <ellipse cx="26" cy="61.3" rx="3.5" ry="5.6" fill="#1E2836" transform="rotate(-13 26 61.3)"/>
    <ellipse cx="${flX}" cy="78.8" rx="6.2" ry="9.5" fill="#0D1420" transform="rotate(${flRot} ${flX} 78.8)"/>
    <ellipse cx="${flX}" cy="78.8" rx="3.5" ry="5.6" fill="#1E2836" transform="rotate(${flRot} ${flX} 78.8)"/>
    <ellipse cx="${frX}" cy="77" rx="5" ry="7" fill="#0D1420" opacity=".85" transform="rotate(${frRot} ${frX} 77)"/>
    <ellipse cx="${frX}" cy="77" rx="2.7" ry="4" fill="#1E2836" opacity=".85" transform="rotate(${frRot} ${frX} 77)"/>
    </g>
  </svg>`;
}

export function busShadowSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
    <defs>
      <radialGradient id="bus-shadow" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#000000" stop-opacity=".4"/>
        <stop offset=".62" stop-color="#000000" stop-opacity=".2"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="48" cy="48" rx="46" ry="21" fill="url(#bus-shadow)"/>
  </svg>`;
}
