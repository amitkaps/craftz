# Package

The files every package copies into its own root, unchanged: the release workflow and the config its notes are grouped by. A package is a repository whose `package.json` isn't private, which today means markz, prose and sitez. This repository isn't one, so the files live here rather than in its own `.github/`.

The survey checks each package's copies against these, word for word. Change them here first, as with the rest of [the standard](../docs/standard.md#releases).
