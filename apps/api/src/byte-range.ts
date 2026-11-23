/**
 * Answers a request for a whole file or for one part of it ("Range: bytes=start-end"), the way
 * browsers ask for video. One range per request; a Range header we can't read is ignored (the whole
 * file is sent), and a range past the end of the file gets 416 with the file's size.
 */
export function rangeResponse(file: ArrayBuffer, range: string | undefined, headers: Record<string, string>): Response {
  const size = file.byteLength;
  const base = { ...headers, "Accept-Ranges": "bytes" };
  const whole = () => new Response(file, { status: 200, headers: { ...base, "Content-Length": String(size) } });

  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (!m || (m[1] === "" && m[2] === "")) return whole();

  let start: number;
  let end: number;
  if (m[1] === "") {
    // "bytes=-500": the last 500 bytes
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
  }
  return new Response(file.slice(start, end + 1), {
    status: 206,
    headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
  });
}
