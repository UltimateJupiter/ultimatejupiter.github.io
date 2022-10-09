---
title: "Dissecting Hessian: Understanding Common Structure of Hessian in Neural Networks"
collection: publications
permalink: /publication/2020_Dissecting_Hessian
excerpt: 'We make several new observations about the top eigenspace of layer-wise Hessians and explained the phenomena using Kronecker factorization. The insights also led to better explicit generalization bounds for neural nets.'
date: 2020-10-08
venue: 'arXiv Preprint'
paperurl: 'https://arxiv.org/abs/2010.04261'
citation: 'Wu, Y., Zhu, X., Wu, C., Wang, A. and Ge, R., 2020. Dissecting hessian: Understanding common structure of hessian in neural networks. arXiv preprint arXiv:2010.04261.'
---
Hessian captures important properties of the deep neural network loss landscape. Previous works have observed low rank structure in the Hessians of neural networks. We make several new observations about the top eigenspace of layer-wise Hessian: top eigenspaces for different models have surprisingly high overlap, and top eigenvectors form low rank matrices when they are reshaped into the same shape as the corresponding weight matrix. Towards formally explaining such structures of the Hessian, we show that the new eigenspace structure can be explained by approximating the Hessian using Kronecker factorization; we also prove the low rank structure for random data at random initialization for over-parametrized two-layer neural nets. Our new understanding can explain why some of these structures become weaker when the network is trained with batch normalization. The Kronecker factorization also leads to better explicit generalization bounds.

[Download paper here](https://arxiv.org/pdf/2010.04261.pdf)