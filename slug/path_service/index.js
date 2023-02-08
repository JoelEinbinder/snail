const os = require('os');

function homedir() {
  return process.env.SNAIL_TEST_HOME_DIR || os.homedir();
}
function tmpdir() {
  return process.env.SNAIL_TEST_TMP_DIR || os.tmpdir();
}
module.exports = {
  homedir,
  tmpdir,
};