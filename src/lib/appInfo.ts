import pkg from "../../package.json";

export const APP_NAME = "multi-looper";
// package.json needs full semver; drop a trailing ".0" patch for display (1.0.0 → 1.0)
export const APP_VERSION: string = pkg.version.replace(/\.0$/, "");
export const CONTACT_EMAIL = "multilooper@gmail.com";
export const AUTHOR_NAME = "Maxime Ancelin";
export const AUTHOR_URL = "https://maxime-ancelin.com";
