"use client";

import { ShaderMaterial, Vector2, type Texture } from "three";

export class ShaderManager {
  readonly material: ShaderMaterial;

  constructor() {
    this.material = new ShaderMaterial({
      uniforms: {
        texA: { value: null as Texture | null },
        texB: { value: null as Texture | null },
        mixValue: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D texA;
        uniform sampler2D texB;
        uniform float mixValue;

        void main() {
          vec4 base = texture2D(texA, vUv);
          vec4 next = texture2D(texB, vUv);
          gl_FragColor = mix(base, next, clamp(mixValue, 0.0, 1.0));
        }
      `,
      transparent: true,
    });
  }

  updateTextures(texA?: Texture, texB?: Texture, mixValue = 0) {
    if (texA) {
      this.material.uniforms.texA.value = texA;
    }
    if (texB) {
      this.material.uniforms.texB.value = texB;
    }
    this.material.uniforms.mixValue.value = mixValue;
  }
}
