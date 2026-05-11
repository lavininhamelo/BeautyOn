const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: webpackConfig => {
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
