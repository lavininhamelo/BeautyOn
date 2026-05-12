const path = require('path');

const watchLoader = path.resolve(__dirname, 'webpack-add-src-context-watch-loader.js');

function injectTailwindContentWatchLoader(webpackConfig) {
  const addToUse = use => {
    if (!Array.isArray(use)) return;
    const hasPostcss = use.some(
      u =>
        u &&
        typeof u === 'object' &&
        u.loader &&
        String(u.loader).includes('postcss-loader'),
    );
    const already = use.some(
      u =>
        u &&
        typeof u === 'object' &&
        u.loader === watchLoader,
    );
    if (hasPostcss && !already) {
      use.push({ loader: watchLoader });
    }
  };

  webpackConfig.module.rules.forEach(rule => {
    if (!rule.oneOf) return;
    rule.oneOf.forEach(one => {
      if (!one.test || !one.use) return;
      const t = one.test;
      if (!(t instanceof RegExp) || t.source !== '\\.css$') return;
      if (!one.exclude || !(one.exclude instanceof RegExp)) return;
      if (one.exclude.source !== '\\.module\\.css$') return;
      addToUse(one.use);
    });
  });
}

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: webpackConfig => {
      injectTailwindContentWatchLoader(webpackConfig);

      webpackConfig.module.rules = webpackConfig.module.rules.filter(rule => {
        if (!rule.use || !Array.isArray(rule.use)) return true;
        const hasEslintLoader = rule.use.some(
          u =>
            u &&
            typeof u === 'object' &&
            u.loader &&
            String(u.loader).includes('eslint-loader'),
        );
        return !hasEslintLoader;
      });

      webpackConfig.optimization.minimizer =
        webpackConfig.optimization.minimizer.filter(
          plugin =>
            !(
              plugin &&
              plugin.constructor &&
              plugin.constructor.name === 'OptimizeCssAssetsWebpackPlugin'
            ),
        );
      return webpackConfig;
    },
  },
  style: {
    postcss: {
      mode: 'file',
    },
  },
};
