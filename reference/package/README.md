# Package

The files every package copies into its own root, unchanged: the release workflow, the config its notes are grouped by, and the workflow that checks each pull request has one of its labels. A package is a repository whose `package.json` isn't private, like markz, prose and pagez.

They sit apart from the root's files, since a site or a tool doesn't have them. The survey checks each package's copies against these, word for word, as [the rules](../../docs/rules.md#releases) say.
