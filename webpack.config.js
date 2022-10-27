const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
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
  [require.resolve('@babel/preset-env'), { shippedProposals: true, targets: {chrome: '87'}, loose: true }],
];
const typescriptPreset = [require.resolve('@babel/preset-typescript'), { onlyRemoveTypeImports: false }];

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  entry: [
    './src/index',
  ],
  performance: {
    maxAssetSize: 2 * 1024 * 1024,
  },
  devServer: {
    contentBase: path.join(__dirname, './public'),
    hot: true,
    clientLogLevel: 'warning',
  },
  cache: true,
  plugins: [
    new CleanWebpackPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new HtmlWebpackPlugin({
      inject: true,
      template: './public/index.html',
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
    extensions: [ '.tsx', '.ts', '.js', '.jsx', '.d.ts' ],
    alias: {
      common: path.join(__dirname, './xterm.js/src/common'),
      browser: path.join(__dirname, './xterm.js/src/browser')
    }
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
          loader: require.resolve('swc-loader'),
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                decorators: true,
              },
              target: 'es2022',
            }
          }
        },
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: require.resolve('swc-loader'),
          options: {
            jsc: {
              parser: {
                syntax: 'ecmascript',
              },
              target: 'es2022',
            }
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
      // {
      //   test: /\.(cpp|mm)$/,
      //   loader: require.resolve('../joel-cpp-magic/src/loader', {paths: [__dirname]})
      // },
      // {
      //   loader: require.resolve('file-loader'),
      //   // Exclude `js` files to keep "css" loader working as it injects
      //   // its runtime that would otherwise be processed through "file" loader.
      //   // Also exclude `html` and `json` extensions so they get processed
      //   // by webpacks internal loaders.
      //   exclude: [/\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/, /\.css$/i],
      //   options: {
      //     name: 'static/media/[name].[hash:8].[ext]',
      //   },
      // },
    ],
  }

};
