# 3D Physics Sandbox

A real-time interactive 3D physics simulation in your browser. Spawn objects, tweak gravity, and watch them collide.

## [Try it now](https://RajanKCKC.github.io/3D-Physics)

## Quick Start

Open the link above and start clicking. That's it.

- **Click** on the ground to spawn objects
- **Space** to spawn randomly
- **R** to reset everything
- **P** to pause/resume
- **C** to clear objects

## What You Can Do

- Spawn boxes and spheres with adjustable mass and size
- Control gravity (including X and Z axes for chaos)
- Adjust friction, bounce, and air resistance in real-time
- Tweak physics solver iterations for accuracy vs speed
- Slow down or speed up time to see what's happening
- Infinite canvas with automatic object cleanup

## How It Works

Built with **Three.js** for rendering and **Cannon-es** for physics. Objects fall on a wavy ground plane bounded by walls. All physics calculations run client-side at 60 FPS with soft shadows and real-time lighting.

Everything responds instantly to your sliders — change friction mid-fall and watch objects react.

## Made With

- Three.js — 3D rendering
- Cannon-es — Physics engine
- Orbit Controls — Camera control
