module.exports = {
  year: new Date().getFullYear(),
  // Changes on every build, so phones pick up the new version of the saved (offline) copy
  version: Date.now().toString(36)
}
