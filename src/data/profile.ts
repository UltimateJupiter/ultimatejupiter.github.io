// Everything about you that is not a paper / talk / news item lives here.

export const profile = {
  name: 'Xingyu Zhu',
  nameNative: '朱星宇',
  // Used to bold your name in author lists.
  authorAliases: ['Xingyu Zhu'],
  role: 'PhD Candidate in Computer Science',
  affiliation: { name: 'Princeton University', url: 'https://princeton.edu/' },
  email: 'xingyu.zhu@princeton.edu',
  cv: '/uploads/Xingyu_Zhu_CV_PhD.pdf',

  // Short bio in the hero. Markdown-style links are not parsed; use HTML.
  bio: `I am a fourth year PhD Candidate in Computer Science at Princeton University working on
    theoretical machine learning and language modeling. I am fortunate to be advised by Professor
    <a href="https://www.cs.princeton.edu/~arora/">Sanjeev Arora</a>. I did my undergrad at Duke,
    where I was fortunate to be advised by Professor <a href="https://users.cs.duke.edu/~rongge/">Rong Ge</a>.`,

  research: `My interest spans across both theoretical and empirical ML. Recently I am especially
    interested in understanding the power of large language models through a semi-theoretical lens.
    I have also worked on optimization dynamics of deep neural nets. Besides, I am also broadly
    interested in theoretical computer science and algorithmic fairness.`,

  interests: ['Machine Learning Theory', 'Language Modeling', 'Theoretical Computer Science'],

  education: [
    { degree: 'Ph.D. in Computer Science', institution: 'Princeton University', years: '2023 –' },
    {
      degree: 'B.S. in Math & Computer Science',
      institution: 'Duke University',
      years: '2018 – 2022',
      note: 'GPA 3.973/4.0, Magna Cum Laude',
    },
  ],

  links: [
    { label: 'Email', url: 'mailto:xingyu.zhu@princeton.edu' },
    { label: 'Scholar', url: 'https://scholar.google.com/citations?user=Dlya3HMAAAAJ&hl=en' },
    { label: 'GitHub', url: 'https://github.com/UltimateJupiter' },
    { label: 'X', url: 'https://x.com/XingyuZhu_' },
    { label: 'ORCID', url: 'https://orcid.org/0000-0003-1997-4668' },
  ],
};

// How many items the home page shows before linking to the full list.
export const homeLimits = { news: 5, talks: 5, publications: 12, posts: 3 };
