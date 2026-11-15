# Ideas for later

Mesa works today as a website on a phone. If I decide to turn it into a proper app, these are the next steps, roughly in order:

1. **Share ticks between phones.** Right now ticks are saved in each browser. A small shared database would let two phones see the same list.
2. **Add to the home screen.** A few extra files would let the site be installed like an app and work offline in the shop.
3. **Keep a private copy for real use.** This public repo stays on invented data, and a separate private one holds the real household rules.
4. **A login.** Only needed once there is shared data.

The code is already split so that saving ticks lives in one file (`js/storage.js`), which is where step 1 would plug in.
