# Lessons

What building craftz taught, for whoever changes it next. Each lesson says what happened and what to do about it.

## Moving the rules from ship

**A copy is proven by the same output.** The rules came from ship with small changes, so the test was running both drifts and comparing. On repositories that are in line, both print the same ticks, which shows little. So a clone of markz was made to drift on purpose, and both printed the same findings. Do the same when moving a check, so a change in behaviour shows up as a difference.

**The reference has to pass the checks too.** ship's files became [standard/](../standard/), and `prose check` reads them like any other file, since it has no way to leave a folder out. Their links pointed at ship's layout, and `AGENTS.md` carried ship's own section. So links now point at craftz's files or ship's site, and `AGENTS.md` keeps only the sections every repository shares. Keep what's in `standard/` true where it stands, rather than marking it unchecked.
