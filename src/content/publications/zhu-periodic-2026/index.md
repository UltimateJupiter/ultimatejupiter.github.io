---
title: 'Periodic Weak Spots: Phase Sensitivity from Chunked KV-Cache Compression'
authors:
- Xingyu Zhu*
- Pu (Luke) Yi*
- Ziheng Cheng*
- Ang Lv*
- Jing Liu
- Lexing Ying
- Yiyuan Ma
- Xin Dong
date: '2026-09-28'
venue: arXiv
featured: true
image: ./featured.png
caption: 'Needle retrieval at 128K tokens by target residue: DeepSeek-V4-Flash-Base (blue) swings by 40 points, repeating every 4 tokens, its compression stride.'
links:
- name: arXiv
  url: https://arxiv.org/abs/2609.36322
- name: PDF
  url: https://arxiv.org/pdf/2609.36322
- name: Interactive post
  url: /blog/periodic-weak-spots/
abstract: >
  Chunked KV-cache compression reduces the memory and attention costs of long-context inference by
  compressing windows of consecutive tokens into fewer cache entries at a fixed stride. Such
  compression also introduces a new positional coordinate: a token's phase, or its position relative
  to compression-window boundaries. We uncover a systematic asymmetry in models using such
  compression: the same information can be easy to retrieve at one phase and difficult at another.
  We call this periodic variation in retrieval performance phase sensitivity. In large open-weight
  models with such compression, long-context retrieval accuracy can differ by up to 40 percentage
  points across phases, revealing periodic weak spots that average benchmark scores can conceal. To
  investigate this behavior, we pretrain a family of transformers from scratch across multiple
  KV-compression designs, reproducing phase sensitivity across the variants. Mechanistic analysis
  using causal interventions in these models reveals phase specialization: different attention
  components contribute asymmetrically to retrieving information at different source phases. We
  further analyze idealized retrieval models, showing how gradient flow dynamics may favor sharp
  phase specialization. Evaluating models with chunked KV-cache compression thus requires measuring
  across compression phases: high average accuracy can coexist with systematic positional failures.
---
