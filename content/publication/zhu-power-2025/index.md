---
title: On the Power of Context-Enhanced Learning in LLMs
authors:
- Xingyu Zhu*
- Abhishek Panigrahi*
- Sanjeev Arora
date: '2025-03-01'
publishDate: '2025-03-20T18:48:19.577736Z'
publication_types:
- manuscript
publication: 'ICML 2025 **(Spotlight)**'
doi: 10.48550/arXiv.2503.01821
abstract: We formalize a new concept for LLMs, context-enhanced learning. It involves
  standard gradient-based learning on text except that the context is enhanced with
  additional data on which no auto-regressive gradients are computed. This setting
  is a gradient-based analog of usual in-context learning (ICL) and appears in some
  recent works. Using a multi-step reasoning task, we prove in a simplified setting
  that context-enhanced learning can be exponentially more sample-efficient than standard
  learning when the model is capable of ICL. At a mechanistic level, we find that
  the benefit of context-enhancement arises from a more accurate gradient learning
  signal. We also experimentally demonstrate that it appears hard to detect or recover
  learning materials that were used in the context during training. This may have
  implications for data security as well as copyright.

# Display this page in the Featured widget?
featured: true
image:
  caption: 'Sample efficiency of context-enhanced learning'
  focal_point: ""
  preview_only: false

tags:
- Computer Science - Machine Learning
links:
- name: URL
  url: http://arxiv.org/abs/2503.01821
---
