[中文](README.md) | [English](README.en.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

# ShotWrapped — a year-in-review for your screenshots

> Your photos show where you've been. Your screenshots are different. They're the stuff you were afraid of forgetting, the prices you compared, the receipts you kept. What you actually cared about this year is in there.

## Why I built this

It started with a "storage almost full" warning, which is how most of my side projects start, honestly.

I went in expecting to delete a bunch of photos. Turns out photos weren't the problem. I had three thousand screenshots. Verification codes. Parcel pickup codes. Half-finished chats. A price comparison from March that I definitely never looked at again.

Deleting them blind felt wrong — what if an invoice or a warranty receipt was buried in there? But scrolling through three thousand screenshots one by one wasn't happening either.

The other thing I noticed, somewhere around screenshot #400: this folder is more honest than my camera roll. Photos are posed. Screenshots are evidence. They know which month wrecked you, what you were thinking about at 1 a.m., and where the money went. So I built a little tool that reads only the screenshots and hands you a report. Then you decide what goes.

## What it does

- Drop your screenshots in. It counts them, weighs them, finds your busiest month, and tells you what share were taken between 11 p.m. and 5 a.m. (mine was not a flattering number)
- Finds the duplicates — the same screen grabbed three times "just in case" — using a perceptual hash, keeping the earliest copy of each set
- Reads a sample of them with OCR and sorts them into buckets: expired junk (codes, pickup numbers), payments and receipts, shopping, chats, notes, trips. It then estimates the totals for the whole pile, and it says "estimate" right on the page, because that's what it is
- Builds five report cards — total count, busiest month, your late-night ratio, the category you can't bring yourself to delete, and how much space you could get back — as 1080×1440 PNGs you can actually post
- Writes a delete list: filenames of duplicates and expired stuff. **It never deletes anything itself.** That part is on you. I'd rather not be responsible for your one important receipt

## How to use it

1. Download `index.html` from this repo
2. Double-click it. It opens in your browser
3. Drag your screenshots in (copy them off your phone first, or pick the whole folder) and wait a few seconds

No screenshots handy? There's a "demo first" button with 428 made-up ones, so you can see what the report looks like before trusting it with yours.

## The honest bits

- The OCR only samples — 60 screenshots by default — and scales up. If you have thousands, treat the category numbers as a good guess, not an audit.
- Nothing here touches your files. Dedup is visual similarity, and the delete list is just a list.
- Picking a folder from a phone browser is clunky, so this version is really meant for a desktop browser. One extra copy step, sorry.
- The OCR engine (Tesseract.js) loads from a CDN the first time you ask for it. If it can't load, you still get the stats, the duplicates and the cards — the categories just stay empty.

## Privacy

Everything runs in your browser. No server, no account, nothing uploaded, and closing the tab leaves nothing behind. That's not a feature bullet, it's the minimum for a tool that reads screenshots full of codes and orders.

## Under the hood

One HTML file. Vanilla JS. No build step, no backend. The hash is a 9×8 dHash; the OCR is optional and loaded on demand. If you want to change something, it's all in the one file — break it, re-download it, no harm done.

## Maybe later

- [ ] Faster local recognition that doesn't need sampling
- [ ] Year-over-year: this year's screenshot habits vs. last year's
- [ ] A version that works properly on the phone itself

MIT license. A star is appreciated; an issue telling me what broke is appreciated more.
