/** Shared WebGL defaults for structure motifs — keeps DPR and GPU prefs consistent. */

export const STRUCTURE_DPR: [number, number] = [1, 1.25]

export const STRUCTURE_GL = {
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance' as const,
  stencil: false,
}

export const STRUCTURE_GL_OPAQUE = {
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance' as const,
  stencil: false,
}
