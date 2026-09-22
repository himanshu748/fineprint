import { modalChat } from '../src/lib/modal';
const answer = await modalChat([
  { role: 'system', content: 'Reply briefly and factually.' },
  {
    role: 'user',
    content:
      'A competition FAQ permits one entry but its contest rules say unlimited entries. Can a checker safely state two entries are eligible without resolving the conflict? Explain in one sentence.',
  },
]);
if (!answer.content) throw new Error('Modal did not return a text answer.');
console.log(
  JSON.stringify(
    {
      provider: 'Modal',
      model: process.env.MODAL_MODEL,
      verifiedAt: new Date().toISOString(),
      answer: answer.content,
    },
    null,
    2,
  ),
);
