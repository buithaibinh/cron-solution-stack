module.exports = {
  entry: ['./dist/src/index.js'],
  target: 'node',
  mode: 'production',
  output: {
    path: `${process.cwd()}/dist/packed`,
    filename: 'index.js',
    libraryTarget: 'umd'
  }
};
