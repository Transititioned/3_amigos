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
    {
      id: 'line-5',
      speakerId: 'leo',
      text: 'I’ll send the three-line recap before lunch. Ambitious, but achievable.',
      audioSrc: '/audio/leo-02.mp3',
    },
    {
      id: 'line-6',
      speakerId: 'bea',
      text: 'Excellent. I’ll believe it when the recap has a timestamp.',
      audioSrc: '/audio/bea-02.mp3',
    },
  ],
};

const contractionExpansions = new Map(Object.entries({
  "ain't": 'is not',
  "aren't": 'are not',
  "can't": 'cannot',
  "could've": 'could have',
  "couldn't": 'could not',
  "didn't": 'did not',
  "doesn't": 'does not',
  "don't": 'do not',
  "hadn't": 'had not',
  "hasn't": 'has not',
  "haven't": 'have not',
  "he'd": 'he would',
  "he'll": 'he will',
  "he's": 'he is',
  "i'd": 'I would',
  "i'll": 'I will',
  "i'm": 'I am',
  "i've": 'I have',
  "isn't": 'is not',
  "it'll": 'it will',
  "it's": 'it is',
  "let's": 'let us',
  "might've": 'might have',
  "mustn't": 'must not',
  "shan't": 'shall not',
  "she'd": 'she would',
  "she'll": 'she will',
  "she's": 'she is',
  "should've": 'should have',
  "shouldn't": 'should not',
  "that's": 'that is',
  "there's": 'there is',
  "they'd": 'they would',
  "they'll": 'they will',
  "they're": 'they are',
  "they've": 'they have',
  "wasn't": 'was not',
  "we'd": 'we would',
  "we'll": 'we will',
  "we're": 'we are',
  "we've": 'we have',
  "weren't": 'were not',
  "what's": 'what is',
  "who's": 'who is',
  "won't": 'will not',
  "would've": 'would have',
  "wouldn't": 'would not',
  "you're": 'you are',
  "you've": 'you have',
  "you'll": 'you will',
  "you'd": 'you would',
}));

// Keep the reader-facing transcript intact while expanding contractions for TTS.
export function getSpokenText(line) {
  const text = line.spokenText ?? line.text;
  return text.replace(/\b[\p{L}]+(?:['’][\p{L}]+)+\b/gu, (contraction) => {
    const normalized = contraction.replaceAll('’', "'").toLowerCase();
    const expanded = contractionExpansions.get(normalized);
    if (!expanded) return contraction;
    return contraction[0] === contraction[0].toUpperCase()
      ? expanded[0].toUpperCase() + expanded.slice(1)
      : expanded;
  });
}

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
    if (line.spokenText !== undefined && (typeof line.spokenText !== 'string' || !line.spokenText.trim())) {
      throw new TypeError(`Line ${line.id} spokenText must be a non-empty string when provided`);
    }
    if (line.audioSrc !== null && typeof line.audioSrc !== 'string') throw new TypeError(`Line ${line.id} audioSrc must be a string or null`);
    lineIds.add(line.id);
  }
  return script;
}
