> **⏸ On pause.** This project isn't being worked on or maintained right now. I'm building
> [Plenty Flow](https://github.com/d-plenty/Plentyflowpilates), a Pilates class planner for iPhone
> and iPad, and I'll come back to this at a later date. Issues and pull requests may not get a reply
> until then.

# OpenPilates

Class planning for mat and reformer Pilates instructors, on your iPhone or iPad.

Plan a class block by block, see what it really does (time, spring changes, muscle balance, how the
spine moves), then teach from it. Everything stays on your device. No account, no ads, no tracking.

**Version 0.2.0. Still early: keep backups.**

- **iPhone and iPad**: one app for both. Install guide: [docs/IPHONE.md](docs/IPHONE.md).
- **Android**: planned, not started.
- **A computer**: planned. Until then there is [OpenPilates Server](https://github.com/d-plenty/OpenPilates-server),
  the self-hosted web version, which is on pause while the apps are built. The app reads its files.

## What it does

- **A library of 184 movements and 18 ready-built series**, each with a drawn start and finish
  position, springs, layers, variations and cautions. Add your own, or change any of them.
- **A block builder.** A class is made of blocks: one movement and what you build on it (the version,
  springs, layers, a finisher, what you offer anyone who needs less). Phases are optional.
- **Drafts.** Pick a class type, length, level and focus and get a full class that fits the time, to edit.
- **Checks as you plan**: time against each phase, spring changes, muscle balance, spine movement, props.
- **My studios.** Each place you teach has its own reformer brand, springs and props. A class planned
  at one studio shows the right springs at another; on Play the app asks which studio you are at.
- **Play.** One block at a time with a timer, springs and what is next. A dark screen that stays awake.
- **Calendar.** Put a date on a class; finishing a class in Play logs it as taught.
- **Run sheet** to print or save.
- **Sharing.** Send a class to another device on the same Wi-Fi by QR code, or as a file.
- **Backups**, made about once a day when the app is opened, kept in the Files app.
- **Look and colours**: light, dark, true black, seven colours or your own.
- **Accessibility**: text size, bold text, high contrast, reading spacing, bigger buttons, less motion.

### Coming later (shown greyed out in the app)

Sync between your own devices over Wi-Fi · a studio server you host yourself, end-to-end encrypted ·
clients (with the studio server) · a computer version · home screen widgets · Apple Watch control.

## The library is a draft

Every movement was written for OpenPilates, in its own words, and cross-checked against published
sources for its name and usual springs (see [src/library/SOURCES.md](src/library/SOURCES.md)). Set-up,
cues and muscles still need an instructor's eye. It is a planning aid for qualified instructors, not
teaching or medical advice.

## Building it

See [BUILD.md](BUILD.md). In short: `npm ci`, `npm test`, `npm run build`. The iPhone app is built by
a GitHub Action on a Mac; nobody needs to own one.

## Privacy

Nothing leaves your device unless you share it. See [PRIVACY.md](PRIVACY.md).

## Licence

The app is free software under the [GNU GPL, version 3 or later](LICENSE). The movement library is
under [CC BY-SA 4.0](LICENSE-DATA.md).
