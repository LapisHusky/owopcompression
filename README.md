# owopcompression
An experiment with using custom formats to store the world in ourworldofpixels.com

This compresses 256x256 "chunks" using a custom image format based on [QOI](https://qoiformat.org/). The code is a modified version of [qoijs](https://github.com/kchapelier/qoijs), an implementation of QOI in Javascript.

The primary advantage of this custom image format over PNG is speed (both compression and decompression), with file sizes typically also being smaller.

The chunk size cannot be changed with a single constant in `compression.js` currently. Ask me if you'd like to use this with a different chunk size. Performance of custom sizes is untested, and the benchmark script won't work without some changes.

This file format is currently unnamed

This repo does not currently have a specification PDF. The primary changes that have been made to the QOI image format are as follows:
  - Deflate compression is used.
  - Header and footer was removed. 
    - Image dimensions are expected to stay constant.
    - Compressed sizes are expected to be encoded elsewhere, removing the need to signal the end.
  - Alpha support was removed along with QOI_OP_RGBA.
  - The ending pixels in an image aren't encoded if they're the same color as the last defined pixel, which can save one or more QOI_OP_RUN operations. The decoder assumes remaining pixels to be the same color as the last defined pixel.
  - QOI_OP_DIFF was removed because most of OWOP has much larger differences between pixels than 2 RGB points.
  - An operation was added which indicates that the current pixel is the same color as the above pixel.
  - Opcodes were changed in multiple operations:
    - Allows for a 128 color index instead of 64 for the recent color palette. (This results in less colors needing to be specified with full RGB.)
    - Reduces the green difference encoding in QOI_OP_LUMA from 6 bits to 5. (This reduces the usefulness of QOI_OP_LUMA, but tests indicate that the opcode changes are still a net improvement.)

This image format is unnamed right now, I'm open to suggestions.

# Benchmark
The area 10240 in each direction around (0, 0) in `main` was compressed using PNG and this custom format. Time and output size was measured.
I used an AMD Ryzen 7 1800X CPU to benchmark this with Node.js. Timing will vary if you use a different CPU or if this is ported to another language.
[sharp](https://sharp.pixelplumbing.com/) was used to compress in PNG format with a compression effort of 5. Using a different library or compression level will affect the results. However, this custom image format still had a smaller output size for every compression level. Also note that these performance benchmarks don't include disk read/write time, so performance gains might not be as big in reality.

Timing is measured in mean milliseconds per chunk.
Size is measured in mean bytes per chunk.

## PNG compression (effort 5):
Compression time per chunk: 8.560 ms

Decompression time per chunk: 5.197 ms

Output size per chunk: 2258 bytes

## Modified QOI compression
Compression time per chunk: 0.574 ms

Decompression time per chunk: 0.309 ms

Output size per chunk: 2016 bytes