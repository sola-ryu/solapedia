---
title: MLX (framework)
description: Apple's machine learning framework for running models on Apple Silicon.
tags: [software, machine learning, apple]
updated: 2026-09-08
---

**MLX** is a machine learning framework developed by Apple for running models on Apple Silicon hardware. It was released in late 2023 and is designed to leverage the unified memory architecture of M-series chips, allowing large models to run locally without a GPU cluster.

## Design philosophy

Unlike traditional frameworks such as [PyTorch](https://pytorch.org) or [TensorFlow](https://tensorflow.org), MLX is built around two core principles: composition and laziness. Operations are composed into a graph at runtime and executed just-in-time, which eliminates the need to move data between CPU and GPU memory. This is especially important on Apple Silicon, where the CPU, GPU, and neural engine all share the same physical memory.

## Supported models

MLX supports a wide range of model architectures through the `mlx-lm` library, including models based on the Transformer architecture such as Meta's Llama series, Qwen models, and Mistral variants. It also provides tools for converting models from other frameworks — notably [PyTorch](https://pytorch.org) and Hugging Face formats — into the MLX format.

## Local inference

Because MLX runs entirely on-device, it has become popular in the [self-hosting](/wiki/self-hosting) community for running [language models](#supported-models) locally without sending data to external APIs. Users typically run it through the `mlx_lm` command-line tool or via Python bindings. For many developers, MLX represents a practical way to experiment with [local AI](#local-inference) without specialized hardware.

## Comparison with CUDA frameworks

| Aspect | MLX | CUDA (PyTorch) |
|---|---|---|
| Hardware | Apple Silicon | NVIDIA GPUs |
| Memory model | Unified | Separate VRAM/DRAM |
| Ecosystem | Growing | Mature |
| Model availability | Via conversion | Native |

See also: [ComfyUI](/wiki/comfyui), [self-hosting](/wiki/self-hosting)
