/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.glsl' {
  const content: string
  export default content
}

