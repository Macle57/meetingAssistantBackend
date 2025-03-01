
This is the backend for meeting assistant which facilates analyzing the meeting frames and audio to be displayed on the UI.

```bash
deno install
deno run --allow-sys --allow-read --allow-write --allow-env --allow-run --allow-net --env-file .\main.ts
```

to debug, you can just pass the url as cmd args
for eg
```bash
deno run --allow-sys --allow-read --allow-write --allow-env --allow-run --allow-net --env-file .\main.ts https://us04web.zoom....
```

and press l to leave the meeting from the terminal, wait for about 3 secs, (might have to press again if doesnt response)

