// The paper illustrations: which paper each one is drawn after, and its one-line caption.
// Pure data, so pages can read it at build time. The drawing code is in the sibling files.
//
// These are illustrations, not figures: each takes one idea from a paper and draws it for its
// own sake. The captions say what is drawn; "Drawn after" links the paper.

export interface PlateMeta {
  id: string;
  /** Folder name of the paper under src/content/publications/. */
  slug: string;
  /** Short name of the paper for the caption link. */
  paper: string;
  /** What the picture shows. HTML is allowed (kept to <i> for symbols). */
  text: string;
  /** One short line for narrow screens, close to the paper's title. The part in [brackets] becomes the link to the paper. */
  short: string;
}

export const PLATES: PlateMeta[] = [
  {
    id: 'bifurcation',
    short: '[Edge of stability] dynamics in a minimalist example',
    slug: 'zhu-understanding-2023',
    paper: 'Understanding Edge-of-Stability Training Dynamics with a Minimalist Example',
    text: 'Gradient descent on ¼(<i>a</i>² − 1)²: where the iterates end up at each step size <i>η</i>. Past 2 / sharpness, the minimum can no longer hold them.',
  },
  {
    id: 'phase',
    short: 'Chunked KV compression causes [periodic weak spots]',
    slug: 'zhu-periodic-2026',
    paper: 'Periodic Weak Spots',
    text: 'Columns are tokens, in windows of eight; rows are attention heads; each square is how much a head keeps of that slot. Some heads keep the same slot in every window. A phase none of them keeps is a weak spot: the orange shafts.',
  },
  {
    id: 'drag',
    short: '[Contextual drag] from wrong attempts left in the context',
    slug: 'cheng-contextual-drag-2026',
    paper: 'Contextual Drag',
    text: 'Lines of reasoning run left to right. Each wrong attempt left in the context pulls the lines that pass after it into its wake.',
  },
  {
    id: 'braid',
    short: '[Context-enhanced learning] through open phrasebooks',
    slug: 'zhu-power-2025',
    paper: 'On the Power of Context-Enhanced Learning in LLMs',
    text: 'Tokens crossing a row of phrasebooks, rewritten at each one: the multi-step translation task a model learns far faster with the phrasebooks open in its context.',
  },
  {
    id: 'lattice',
    short: '[T²MLR] threads a recurrence through the middle layers',
    slug: 'cai-t2mlr-2026',
    paper: 'T²MLR',
    text: 'Tokens left to right, layers bottom to top. Each token hands a middle-layer state down to an earlier layer of the next, threading a recurrence through the stack.',
  },
  {
    id: 'kron',
    short: '[Dissecting Hessian] into its common Kronecker structure',
    slug: 'wu-dissecting-2022',
    paper: 'Dissecting Hessian',
    text: 'A large matrix built from two small ones: every block is the same small pattern, rescaled. The paper finds this structure in the Hessians of neural networks.',
  },
  {
    id: 'match',
    short: '[Fair assignment] when applicants’ priorities are uncertain',
    slug: 'shen-fairness-2023',
    paper: 'Fairness in the Assignment Problem with Uncertain Priorities',
    text: 'Applicants along the top, seats along the bottom. When the priority order is uncertain, each applicant holds a lottery over seats rather than a single one.',
  },
];

export const plateForPaper = (slug: string) => PLATES.find((p) => p.slug === slug);
