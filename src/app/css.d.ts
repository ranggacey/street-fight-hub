// TypeScript 6 memeriksa side-effect import (noUncheckedSideEffectImports
// default true), sementara Next.js tidak lagi mendeklarasikan "*.css" global.
// Deklarasi ini membuat `import "./globals.css"` di layout typecheck;
// file CSS tetap diproses oleh Next/Tailwind saat build.
declare module "*.css";
