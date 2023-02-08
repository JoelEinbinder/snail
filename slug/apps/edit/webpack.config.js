const path = require('path');
const isDevelopment = process.env.NODE_ENV === 'development';

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
    ],
  }

};
