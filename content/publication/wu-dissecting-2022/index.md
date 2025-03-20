---
title: 'Dissecting Hessian: Understanding Common Structure of Hessian in Neural Networks'
authors:
- Yikai Wu
- Xingyu Zhu
- Chenwei Wu
- Annie Wang
- Rong Ge
date: '2022-10-01'
publishDate: '2025-03-20T18:48:19.552024Z'
publication_types:
- manuscript
publication: '*arXiv*'
abstract: Hessian captures important properties of the deep neural network loss landscape.
  Previous works have observed low rank structure in the Hessians of neural networks.
  In this paper, we propose a decoupling conjecture that decomposes the layer-wise
  Hessians of a network as the Kronecker product of two smaller matrices. We can analyze
  the properties of these smaller matrices and prove the structure of top eigenspace
  random 2-layer networks. The decoupling conjecture has several other interesting
  implications - top eigenspaces for different models have surprisingly high overlap,
  and top eigenvectors form low rank matrices when they are reshaped into the same
  shape as the corresponding weight matrix. All of these can be verified empirically
  for deeper networks. Finally, we use the structure of layer-wise Hessian to get
  better explicit generalization bounds for neural networks.
tags:
- Computer Science - Machine Learning
- Computer Science - Neural and Evolutionary Computing
- I.2.6
- Statistics - Machine Learning
links:
- name: URL
  url: http://arxiv.org/abs/2010.04261
---
