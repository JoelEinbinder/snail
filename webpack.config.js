const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require('webpack');
const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const isDevelopment = process.env.NODE_ENV === 'development';

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  entry: {
    main: ['./src/index'],
    'game-iframe': './game/game-iframe',
  },
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
      filename: 'index.html',
      template: './public/index.html',
      chunks: ['main'],
    }),
    new HtmlWebpackPlugin({
      inject: true,
      filename: 'game-iframe.html',
      template: './public/game-iframe.html',
      chunks: ['game-iframe'],
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
        test: /\.woff$/,
        exclude: /node_modules/,
        use: {
          loader: require.resolve('file-loader'),
        },
      },
      {
        test: /\.png$/,
        exclude: /node_modules/,
        use: {
          loader: require.resolve('file-loader'),
        },
      },
      {
        test: /\.mp3$/,
        exclude: /node_modules/,
        use: {
          loader: require.resolve('file-loader'),
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
