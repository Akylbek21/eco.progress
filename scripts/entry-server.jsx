import React from 'react';
import { renderToReadableStream } from 'react-dom/server.browser';
import { StaticRouter } from 'react-router-dom/server';
import PublicApplication from '../src/PublicApplication';

const RENDER_TIMEOUT_MS = 15_000;

export const renderPublicApp = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`React prerender timed out for ${url}`)), RENDER_TIMEOUT_MS);
  timeout.unref();

  try {
    const stream = await renderToReadableStream(
    <React.StrictMode>
      <StaticRouter location={url}>
        <PublicApplication />
      </StaticRouter>
    </React.StrictMode>,
    {
      onError(error) {
        console.error(`[prerender] React render error for ${url}`, error);
      },
      signal: controller.signal,
    },
    );
    await stream.allReady;
    return await new Response(stream).text();
  } finally {
    clearTimeout(timeout);
  }
};
