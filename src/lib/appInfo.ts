import pkg from "../../package.json";

export const APP_NAME = "multi-looper";
// package.json needs full semver; drop a trailing ".0" patch for display (1.0.0 → 1.0)
export const APP_VERSION: string = pkg.version.replace(/\.0$/, "");
export const CONTACT_EMAIL = "multilooper@gmail.com";
export const AUTHOR_NAME = "Maxime Ancelin";
export const AUTHOR_URL = "https://maxime-ancelin.com";
export const REPO_URL = "https://github.com/mancelin/multi-looper";
export const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md`;
export const LICENSE_NAME = "AGPL-3.0-or-later";
export const LICENSE_URL = "https://www.gnu.org/licenses/agpl-3.0.html";

/**
 * Everyone with a merged pull request, mirrored from CONTRIBUTORS.md (newest last).
 * The author is credited separately, so this lists outside contributors only.
 */
export const CONTRIBUTORS: { name: string; url: string }[] = [];
