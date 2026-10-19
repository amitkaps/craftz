# Design

## What it is

One way every repository builds, checks, deploys and releases, and the repository that shows it working. Each repository depends on `@amitkaps/craftz`, and it holds the standard, its checks and fixes, and the commands that act on them.

## Why

Every repository holds copies of ship's standard today, and ship checks and moves them. craftz puts each rule in one place, so a repository checks itself against the version it installs. [ship's plan](https://ship.amitkaps.com/docs/plan.md#craftz) has the full design until it moves here.

## What it isn't

It isn't an app framework. Vite+ and each framework keep their own build, and craftz connects them. It never holds secrets, only settings.
