/**
 * Holds the current access token in a plain JS variable (module scope),
 * NOT in localStorage/sessionStorage. This is deliberate: browser storage
 * is readable by any script on the page, so a successful XSS attack could
 * steal a token sitting there. An in-memory variable disappears on page
 * refresh, which is why AuthContext re-establishes it on load using the
 * httpOnly refresh-token cookie (see AuthContext.jsx).
 */
let accessToken = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const clearAccessToken = () => {
  accessToken = null;
};
