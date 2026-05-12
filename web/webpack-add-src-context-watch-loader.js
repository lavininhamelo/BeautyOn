/**
 * CRA 3 uses postcss-loader@3, which ignores Tailwind 3 `dir-dependency` messages.
 * Without this, Webpack does not rebuild `index.css` when only `.tsx`/`.jsx` files change.
 * @see https://github.com/webpack-contrib/postcss-loader/blob/v3.0.0/src/index.js (only handles msg.type === 'dependency')
 */
const path = require('path');

const SRC = path.join(__dirname, 'src');

module.exports = function addSrcContextWatchLoader(content) {
  this.addContextDependency(SRC);
  return content;
};
