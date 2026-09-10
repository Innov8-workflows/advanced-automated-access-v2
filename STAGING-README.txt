Staging copy of the Advanced Automated Access site (light variant).

Built from _site with every root-absolute path prefixed with /advanced-automated-access-v2 so it works
from a GitHub Pages project subpath. Every page is noindex.

This is for review only. It is NOT what goes live:
  - the production build in _site has no path prefix and no noindex
  - the 45 entries in _redirects do nothing on GitHub Pages. They are honoured
    by Cloudflare Workers, which is the real deploy target.
