// Each dialogue line points to its bundled prerecorded clip under /audio/.
export const demoScript = {
  id: 'demo-meeting',
  title: 'The Missing Monday',
  characters: [
    { id: 'mara', name: 'Mara', voice: 'Warm, decisive facilitator' },
    { id: 'leo', name: 'Leo', voice: 'Curious, energetic optimist' },
    { id: 'bea', name: 'Bea', voice: 'Dry, practical skeptic' },
  ],
  lines: [
    { id: 'line-1', speakerId: 'mara', text: 'Quick check-in: why does Monday feel like it arrived twice this week?', audioSrc: '/audio/mara-01.mp3' },
    { id: 'line-2', speakerId: 'leo', text: 'Because the calendar is testing a bold new feature: surprise Mondays.', audioSrc: '/audio/leo-01.mp3' },
    { id: 'line-3', speakerId: 'bea', text: 'I filed a bug. The calendar replied that this is a lifestyle choice.', audioSrc: '/audio/bea-01.mp3' },
    { id: 'line-4', speakerId: 'mara', text: 'Let’s make one small plan so tomorrow doesn’t become Monday three.', audioSrc: '/audio/mara-02.mp3' },
    { id: 'line-5', speakerId: 'leo', text: 'I’ll send the three-line recap before lunch. Ambitious, but achievable.', audioSrc: '/audio/leo-02.mp3' },
    { id: 'line-6', speakerId: 'bea', text: 'Excellent. I’ll believe it when the recap has a timestamp.', audioSrc: '/audio/bea-02.mp3' },
  ],
};

export function validateScript(script) {
  if (!script || !Array.isArray(script.lines) || !Array.isArray(script.characters)) {
    throw new TypeError('Script must include characters and lines arrays');
  }
  const characterIds = new Set(script.characters.map(({ id }) => id));
  const lineIds = new Set();
  for (const line of script.lines) {
    if (!line.id || lineIds.has(line.id)) throw new TypeError(`Line IDs must be present and unique: ${line.id}`);
    if (!characterIds.has(line.speakerId)) throw new TypeError(`Unknown speaker for line ${line.id}: ${line.speakerId}`);
    if (typeof line.text !== 'string' || !line.text.trim()) throw new TypeError(`Line ${line.id} must have transcript text`);
    if (line.audioSrc !== null && typeof line.audioSrc !== 'string') throw new TypeError(`Line ${line.id} audioSrc must be a string or null`);
    lineIds.add(line.id);
  }
  return script;
}
