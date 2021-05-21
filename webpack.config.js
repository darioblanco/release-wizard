const path = require('path');

module.exports = {
  entry: ['./src/index.ts'],
  mode: "production",
  module: {
    rules: [
      {
        test: /.tsx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.json",
              transpileOnly: true
            }
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "run.js",
    path: path.resolve(__dirname, 'dist'),
  },
  target: "node"
};
