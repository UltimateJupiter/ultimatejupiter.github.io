---
title: Example post (template)
date: '2026-09-28'
description: A draft that shows what a Markdown post can contain. Drafts only appear while running the dev server; copy this file to start a new post.
tags: [template]
draft: true
---

Write in plain Markdown. Inline math like $\eta < 2/\lambda_{\max}$ and display math both work:

$$
\theta_{t+1} = \theta_t - \eta \nabla L(\theta_t) + \beta(\theta_t - \theta_{t-1}).
$$

## A section

Headings (`##`, `###`) feed the table of contents that appears beside long posts on wide screens.
Footnotes work too.[^1]

```python
def heavy_ball(grad, theta, lr=1e-2, beta=0.9, steps=100):
    v = 0
    for _ in range(steps):
        v = beta * v - lr * grad(theta)
        theta = theta + v
    return theta
```

> Quotes are set in italics with a thin accent rule.

### Images

Put the post in a folder (`src/content/blog/my-post/index.md`) and reference images next to it,
e.g. `![Alt text](./figure.png)`.

## Another section

| step size | behaviour        |
| --------- | ---------------- |
| small     | smooth descent   |
| $2/\lambda$ | edge of stability |

[^1]: Like this one.
