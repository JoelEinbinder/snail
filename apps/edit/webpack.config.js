const path = require('path');
const isDevelopment = process.env.NODE_ENV === 'development';

const babelPlugins = [
  [require.resolve('@babel/plugin-proposal-decorators'), {
    legacy: true,
  }],
  [require.resolve('@babel/plugin-proposal-class-properties'), {loose: true}],
  require.resolve('babel-plugin-transform-typescript-metadata'),
  require.resolve('@babel/plugin-proposal-optional-chaining'),
];
const babelPresets = [
  // [require.resolve('@babel/preset-env'), { shippedProposals: true, targets: {chrome: '87'}, loose: true }],
];
const typescriptPreset = [require.resolve('@babel/preset-typescript'), { onlyRemoveTypeImports: false }];

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  entry: path.resolve(__dirname, '..', '..', 'shjs', 'editorMode.ts'),
  cache: true,

  output: {
    filename: 'lib.js',
    library: {
      type: 'module',
    },
    path: path.resolve(__dirname, 'build'),
    module: true,
    environment: {
      module: true,
    }
  },
  experiments: {
    topLevelAwait: true,
    outputModule: true,
  },
  resolve: {
    extensions: [ '.ts', '.js', '.d.ts' ],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: require.resolve('babel-loader'),
          options: {
            presets: [
              typescriptPreset,
              ...babelPresets
            ],
            plugins: babelPlugins,
          }
        },
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: require.resolve('babel-loader'),
          options: {
            presets: babelPresets,
            plugins: babelPlugins,
          }
        },
      },
      {
        test: /\.m?js$/,
        include: /node_modules/,
        use: {
          loader: require.resolve('source-map-loader'),
          options: {
            filterSourceMappingUrl: () => false
          }
        }
      },
    ],
  }

};
