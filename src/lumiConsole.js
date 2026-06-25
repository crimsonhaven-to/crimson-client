// Lumi in the devtools console.
//
// A styled boot banner (the classic "you found the console" easter egg) plus a
// chatty `window.lumi` object so anyone poking around gets talked back to by the
// empress herself. Entirely cosmetic — no app state, no network, no side effects
// beyond `console.*` and one global. Safe to no-op if anything throws.

const EMPRESS = 'Luminas Crimsonveil';
const TITLE = 'Eternal Empress of the Crimson Archives';

// ASCII bat-crown sigil for the banner. Kept deliberately small so it survives
// narrow console panes.
const SIGIL = [
  '      /\\                 /\\      ',
  '     / \\\'._   (\\_/)   _.\'/ \\     ',
  '    /_.\'\'._\'--(o.o)--\'_.\'\'._\\    ',
  '            |  \\_/  |           ',
  '         ~ CRIMSON HAVEN ~      ',
].join('\n');

const QUIPS = [
  'Snooping in my console, mortal? How charmingly nosy.',
  'You found the crypt door. Most never look this closely.',
  'Every pixel here bends the knee to me. As do you, now.',
  'Curiosity is a delightful little sin. Indulge.',
  'Type lumi.help() if you dare converse with royalty.',
  'I see all your requests. Yes — even that one.',
];

const BLESSINGS = [
  'I bless your bandwidth. Buffer not. ✨',
  'May your streams run swift and your subtitles never lie.',
  'Watch well. The night is long and the Archives are deep. 🦇',
  'Tonight\'s binge is sanctioned by royal decree. 👑',
  'Even an empress rewinds the good parts. No shame in it.',
];

const FORTUNES = [
  'A great filler arc approaches. Brace yourself.',
  'The dub you fear is better than you remember. Trust me.',
  'Someone is about to recommend you a show. Pretend you haven\'t seen it.',
  'Your "just one episode" will become five. It is foretold.',
  'The cliffhanger will be cruel. I have already enjoyed your suffering.',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function summonLumiConsole() {
  if (typeof window === 'undefined' || !window.console) return;

  const crimson = 'color:#e11d48;font-weight:bold;';
  const soft = 'color:#fda4af;';
  const faint = 'color:#9f1239;font-style:italic;';

  // The banner. %c segments let us paint Lumi's colours into the console.
  console.log(
    `%c${SIGIL}\n\n%c${EMPRESS}%c — ${TITLE}\n\n%c${pick(QUIPS)}`,
    crimson,
    crimson,
    soft,
    faint,
  );
  console.log(
    '%cPsst… there\'s a secret here. The old gamers know the way. ↑ ↑ ↓ ↓ ← → ← → B A',
    faint,
  );

  // A friendly (and slightly smug) object for the curious to play with.
  const lumi = {
    get [Symbol.toStringTag]() { return EMPRESS; },
    hello() {
      console.log(`%c${pick(QUIPS)}`, crimson);
      return 'The empress acknowledges you. Barely.';
    },
    bless() {
      console.log(`%c${pick(BLESSINGS)}`, soft);
      return '🦇';
    },
    fortune() {
      console.log(`%c🔮 ${pick(FORTUNES)}`, soft);
      return undefined;
    },
    help() {
      console.log(
        '%cThe empress permits: %clumi.hello()%c, %clumi.bless()%c, %clumi.fortune()%c. Use them wisely.',
        soft, crimson, soft, crimson, soft, crimson, soft,
      );
      return undefined;
    },
  };

  try {
    Object.defineProperty(window, 'lumi', { value: lumi, configurable: true });
  } catch {
    window.lumi = lumi;
  }
}
