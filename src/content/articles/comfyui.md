---
title: ComfyUI
description: A node-based graphical interface for Stable Diffusion and other generative models.
tags: [software, image generation, ai]
updated: 2026-09-08
---

**ComfyUI** is a node-based graphical user interface for running generative AI models, most notably [Stable Diffusion](https://stability.ai) image generators. It was created as a more flexible and transparent alternative to web-based interfaces, allowing users to construct generation pipelines by connecting discrete processing nodes.

## Node-based architecture

Instead of presenting a single form with parameters, ComfyUI represents every step of the generation process as a node: a text encoder, a sampler, a VAEDecoder, and so on. Users connect nodes with wires to define the flow of data. This makes it possible to inspect intermediate results, chain multiple models together, and automate complex workflows.

## Workflow files

ComfyUI saves user-created pipelines as JSON workflow files, which can be shared, versioned, and imported by others. The ecosystem has grown around reusable templates — for example, [eink wallpaper generation](#eink-wallpapers) and upscaling chains are common community creations.

## Integration with MLX

While ComfyUI is primarily designed for CUDA-based GPUs, the broader local AI community also uses frameworks like [MLX](/wiki/mlx) for running compatible models on Apple Silicon. Some custom nodes and forks have emerged to support non-CUDA backends, though the primary model ecosystem remains CUDA-oriented.

## Use cases

- **Image generation** — text-to-image, image-to-image, inpainting
- **Upscaling** — super-resolution workflows using models like ESRGAN
- **Eink wallpapers** — stylized generation for e-reader displays
- **Workflow automation** — batch processing via CLI execution

See also: [MLX](/wiki/mlx), [self-hosting](/wiki/self-hosting)
