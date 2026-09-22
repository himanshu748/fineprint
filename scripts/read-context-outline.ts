import { withContext } from '../src/lib/source-agent';
const result = await withContext((client) =>
  client.callTool({ name: 'initial_context', arguments: {} }, undefined, { timeout: 25000 }),
);
for (const item of result.content as { type: string; text?: string }[])
  if (item.type === 'text') console.log(item.text);
