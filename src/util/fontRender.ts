import './dirnameFix';

import * as opentype from 'opentype.js';
import TextToSVG from 'text-to-svg';

import { RequestContext } from '..';

export type FontType = 'montserratBold' | 'openSansRegular';

const svgFonts = new Map<FontType, TextToSVG>();

const fontUrls: Record<FontType, string> = {
  montserratBold: 'https://get.snaz.in/2USzmnY.ttf',
  openSansRegular: 'https://get.snaz.in/AJ5f6iV.ttf'
};

interface RenderTextOptions {
  font?: FontType;
  size?: number;
  width?: number;
  wrap?: boolean;
}

interface RenderTextPath {
  d: string;
  metrics: TextToSVG.Metrics;
  line: string;
}

export interface RenderTextResult {
  d: string | null;
  metrics: TextToSVG.Metrics;
  paths?: RenderTextPath[];
}

export async function renderText(
  text: string,
  ctx: RequestContext,
  { font = 'openSansRegular', size = 8, width = 200, wrap = false }: RenderTextOptions = {}
): Promise<RenderTextResult> {
  const options: TextToSVG.GenerationOptions = {
    x: 0,
    y: 0,
    fontSize: size,
    anchor: 'left top'
  };

  const textToSVG = await fetchFont(font, ctx);

  if (!wrap)
    return {
      d: textToSVG.getD(text, options),
      metrics: textToSVG.getMetrics(text, options)
    };

  const glyphWidths: Record<string, number> = {},
    characters = text.split(''),
    lines: string[] = [],
    pathPairs: RenderTextPath[] = [];
  let currentLine = '',
    currentLineWidth = 0,
    currentWord = '',
    currentWordWidth = 0,
    totalHeight = 0,
    totalWidth = width;

  new Set(characters).forEach((char) => {
    glyphWidths[char] = textToSVG.getMetrics(char, options).width;
  });

  characters.map((char) => {
    if (currentLineWidth + currentWordWidth + glyphWidths[char] > width && currentLineWidth !== 0) {
      lines.push(currentLine);
      currentLine = '';
      currentLineWidth = 0;
      currentWord += char;
      currentWordWidth += glyphWidths[char];
    } else if (char === '-' || char === ' ') {
      currentWord += char;
      currentWordWidth += glyphWidths[char];
      currentLine += currentWord;
      currentLineWidth += currentWordWidth;
      currentWord = '';
      currentWordWidth = 0;
    } else {
      currentWord += char;
      currentWordWidth += glyphWidths[char];
    }
  });

  if (currentWord) currentLine += currentWord;
  lines.push(currentLine);
  lines.forEach((line) => {
    const d = textToSVG.getD(line, options),
      metrics = textToSVG.getMetrics(line, options);

    if (lines.length === 1) totalWidth = metrics.width;
    totalHeight += metrics.height;
    pathPairs.push({ d, metrics, line });
  });

  return {
    paths: pathPairs,
    metrics: {
      x: 0,
      y: 0,
      baseline: 0,
      width: totalWidth,
      height: totalHeight,
      ascender: 0,
      descender: 0
    } as TextToSVG.Metrics,
    d: null
  };
}

export async function fetchFontBuffer(font: FontType, ctx: RequestContext) {
  const cached = await ctx.env.BUFFER_CACHE.get(`font/${font}`, {
    type: 'arrayBuffer',
    cacheTtl: 60 * 60 * 24 * 30
  });
  if (cached) return cached;

  const response = await fetch(fontUrls[font], {
    headers: {
      'User-Agent': 'botsgg-worker/1.0'
    }
  });

  const buffer = await response.arrayBuffer();
  await ctx.env.BUFFER_CACHE.put(`font/${font}`, buffer, { expirationTtl: 60 * 60 * 24 * 30 });
  return buffer;
}

export async function fetchFont(fontType: FontType, ctx: RequestContext) {
  if (svgFonts.has(fontType)) return svgFonts.get(fontType);

  const font = opentype.parse(await fetchFontBuffer(fontType, ctx));
  const svgFont = new TextToSVG(font);
  svgFonts.set(fontType, svgFont);
  return svgFont;
}
