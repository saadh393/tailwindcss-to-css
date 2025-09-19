import type { NextApiRequest, NextApiResponse } from 'next';

import { getConvertedClasses } from '../../libs/helpers';
import { COLOR_FORMATS, type ColorFormat } from '../../libs/conversion';

interface ConvertResponse {
  css: string;
  error?: string;
}

export default function handler(
  request: NextApiRequest,
  response: NextApiResponse<ConvertResponse>
) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    response.status(405).json({ css: '', error: 'Method Not Allowed' });
    return;
  }

  try {
    const { input, className, colorFormat } = request.body ?? {};

    const normalizedInput = typeof input === 'string' ? input : '';
    const normalizedClassName =
      typeof className === 'string' ? className : undefined;
    const normalizedColorFormat =
      typeof colorFormat === 'string' &&
      (COLOR_FORMATS as readonly string[]).includes(colorFormat)
        ? (colorFormat as ColorFormat)
        : undefined;

    const css = getConvertedClasses(normalizedInput, {
      className: normalizedClassName,
      colorFormat: normalizedColorFormat,
    });

    response.status(200).json({ css });
  } catch (error) {
    console.error('Conversion API error', error);
    response
      .status(500)
      .json({ css: '', error: 'Unable to convert Tailwind classes' });
  }
}
