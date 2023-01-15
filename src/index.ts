import { Context, Hono } from 'hono';
import { poweredBy } from 'hono/powered-by';

import { handleWidget, WIDGET_TYPES, WidgetType } from './widget';

export interface Env {
  BUFFER_CACHE: KVNamespace;
  DATA_CACHE: KVNamespace;
  SVG_CACHE: KVNamespace;
  BOTGSS_AUTH?: string;
}

export type RequestContext = Context<
  'id' | 'type',
  {
    Bindings: Env;
  },
  unknown
>;

const app = new Hono<{ Bindings: Env }>();

app.use('*', poweredBy());

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.get('/widget/:id/:type{[a-z]+(?:\\.[sS][vV][gG])}', async (c) => {
  const type = c.req.param('type').replace('.svg', '');
  const width = parseInt(c.req.query('w'));
  const widthValid = !isNaN(width) && isFinite(width) && width > 30;
  if (!type || !WIDGET_TYPES.includes(type as WidgetType)) return c.text('Invalid type. Available widget types: ' + WIDGET_TYPES, 400);

  try {
    return c.newResponse(await handleWidget(c.req.param('id'), type as WidgetType, c, widthValid ? width : undefined), 200, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': `${60 * 60 * 3}`
    });
  } catch (e) {
    if (e.message === 'Forbidden') return c.text('Forbidden', 403);
    return c.text('Internal Server Error', 500);
  }
});

export default app;
