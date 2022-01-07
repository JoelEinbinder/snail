const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require('webpack');
const path = require('path');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const isDevelopment = process.env.NODE_ENV === 'development';

const babelPlugins = [
  [require.resolve('@babel/plugin-proposal-class-properties'), {loose: true}],
  require.resolve('@babel/plugin-proposal-optional-chaining'),
];
const babelPresets = [
  [require.resolve('@babel/preset-env'), { shippedProposals: true, targets: {chrome: '87'} }],
];
const babelReactPlugins = [
  ...babelPlugins,
  isDevelopment && require.resolve('react-refresh/babel')
].filter(Boolean);
const babelReactPresets = [
  ...babelPresets,
  require.resolve('@babel/preset-react')
];
const typescriptPreset = [require.resolve('@babel/preset-typescript'), { onlyRemoveTypeImports: true }];

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  entry: [
    './src/index',
  ],
  devServer: {
    contentBase: path.join(__dirname, './public'),
    hot: true,
    clientLogLevel: 'warning',
  },
  cache: true,
  plugins: [
    new CleanWebpackPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new ReactRefreshWebpackPlugin(),
    new HtmlWebpackPlugin({
      inject: true,
      template: './public/index.html',
    }),
    !isDevelopment && new CopyWebpackPlugin({
      patterns: [
        { from: 'public' }
      ]
    }),
    process.env.ANALYZE_BUNDLE === 'true' && new BundleAnalyzerPlugin()
  ].filter(Boolean),
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  experiments: {
    topLevelAwait: true
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js', '.jsx' ]
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        exclude: /node_modules/,
        use: [require.resolve('style-loader'), require.resolve('css-loader')],
      },
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
        test: /\.tsx$/,
        exclude: /node_modules/,
        use: {
          loader: require.resolve('babel-loader'),
          options: {
            presets: [
              typescriptPreset,
              ...babelReactPresets
            ],
            plugins: babelReactPlugins,
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
      {
        test: /\.jsx$/,
        exclude: /node_modules/,
        use: {
          loader: require.resolve('babel-loader'),
          options: {
            presets: babelReactPresets,
            plugins: babelReactPlugins
          }
        },
      },
      // {
      //   test: /\.(cpp|mm)$/,
      //   loader: require.resolve('../joel-cpp-magic/src/loader', {paths: [__dirname]})
      // },
      {
        loader: require.resolve('file-loader'),
        // Exclude `js` files to keep "css" loader working as it injects
        // its runtime that would otherwise be processed through "file" loader.
        // Also exclude `html` and `json` extensions so they get processed
        // by webpacks internal loaders.
        exclude: [/\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/, /\.css$/i],
        options: {
          name: 'static/media/[name].[hash:8].[ext]',
        },
      },
    ],
  }

};
