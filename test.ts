

Deno.stdin.setRaw(true);

const decoder = new TextDecoder();
const reader = Deno.stdin.readable.getReader();

function interuptHandler(reader: ReadableStreamDefaultReader<Uint8Array>) {
        reader.read()
        .then((chunk) => {
        const char = decoder.decode(chunk.value);
        console.log(char);
        interuptHandler(reader);
        });

}
interuptHandler(reader);

console.log("sync code ended")

