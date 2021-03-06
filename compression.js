import { deflateRawSync, inflateRawSync } from "zlib"

//this is a modified version of https://github.com/kchapelier/qoijs optimized for compressing OWOP
//based on the QOI image format https://qoiformat.org/

export function encodeChunk(colorData) {
  const width = 256
  const height = 256

  let red = 0
  let green = 0
  let blue = 0
  let prevRed = red
  let prevGreen = green
  let prevBlue = blue

  let run = 0
  let p = 0
  const pixelLength = width * height * 3
  const pixelEnd = pixelLength - 3

  const maxSize = width * height * (3 + 1)
  const result = Buffer.alloc(maxSize)
  const index = Buffer.alloc(384)

  for (let pixelPos = 0; pixelPos < pixelLength; pixelPos += 3) {
    red = colorData[pixelPos]
    green = colorData[pixelPos + 1]
    blue = colorData[pixelPos + 2]

    mainChecks: {
      if (prevRed === red && prevGreen === green && prevBlue === blue) {
        run++
        break mainChecks
      }
      while (run > 0) {
        // QOI_OP_RUN
        result[p++] = 0b11000000 | (Math.min(63, run) - 1)
        run = Math.max(0, run - 63)
      }

      const indexPosition = ((red * 3 + green * 5 + blue * 7) % 128) * 3

      if (index[indexPosition] === red && index[indexPosition + 1] === green && index[indexPosition + 2] === blue) {
        //this pixel is in the recent color palette, we can just encode a reference to it
        result[p++] = indexPosition / 3
        break mainChecks
      }
      index[indexPosition] = red
      index[indexPosition + 1] = green
      index[indexPosition + 2] = blue

      if (pixelPos > 767 && colorData[pixelPos - 768] === red && colorData[pixelPos - 768 + 1] === green && colorData[pixelPos - 768 + 2] === blue) {
        //this pixel is the same as the above pixel
        result[p++] = 0b10100000
        break mainChecks
      }

      // ternary with bitmask handles the wraparound
      let vr = red - prevRed
      vr = vr & 0b10000000 ? (vr - 256) % 256 : (vr + 256) % 256
      let vg = green - prevGreen
      vg = vg & 0b10000000 ? (vg - 256) % 256 : (vg + 256) % 256
      let vb = blue - prevBlue
      vb = vb & 0b10000000 ? (vb - 256) % 256 : (vb + 256) % 256

      const vg_r = vr - vg
      const vg_b = vb - vg

      if (vg_r > -9 && vg_r < 8 && vg > -17 && vg < 16 && vg_b > -9 && vg_b < 8) {
        // QOI_OP_LUMA
        result[p++] = 0b10000000 | (vg + 16)
        result[p++] = (vg_r + 8) << 4 | (vg_b + 8)
        break mainChecks
      }
      // QOI_OP_RGB
      result[p++] = 0b11111111
      result[p++] = red
      result[p++] = green
      result[p++] = blue
    }

    prevRed = red
    prevGreen = green
    prevBlue = blue
  }

  // return a Buffer trimmed to the correct length
  return deflateRawSync(result.slice(0, p))
}

export function decodeChunk(imageData) {
  imageData = inflateRawSync(imageData)

  const pixelLength = 256 * 256 * 3
  const result = Buffer.alloc(pixelLength)

  let arrayPosition = 0

  const index = Buffer.alloc(384)

  let red = 0
  let green = 0
  let blue = 0

  const chunksLength = imageData.length

  let run = 0
  let pixelPosition = 0

  for (; pixelPosition < pixelLength; pixelPosition += 3) {
    mainChecks: {
      if (run > 0) {
        run--
        break mainChecks
      }
      changingChecks: {
        if (arrayPosition === chunksLength) break changingChecks
        const byte1 = imageData[arrayPosition++]

        if (byte1 === 0b11111111) { // QOI_OP_RGB
          red = imageData[arrayPosition++]
          green = imageData[arrayPosition++]
          blue = imageData[arrayPosition++]
          break changingChecks
        }
        if ((byte1 & 0b10000000) === 0b00000000) { // QOI_OP_INDEX
          red = index[byte1 * 3]
          green = index[byte1 * 3 + 1]
          blue = index[byte1 * 3 + 2]
          break changingChecks
        }
        if ((byte1 & 0b11100000) === 0b10000000) { // QOI_OP_LUMA
          const byte2 = imageData[arrayPosition++]
          const greenDiff = (byte1 & 0b00011111) - 16
          const redDiff = greenDiff + ((byte2 >> 4) & 0b00001111) - 8
          const blueDiff = greenDiff + (byte2 & 0b00001111) - 8

          // handle wraparound
          red = (red + redDiff + 256) % 256
          green = (green + greenDiff + 256) % 256
          blue = (blue + blueDiff + 256) % 256
          break changingChecks
        }
        if ((byte1 & 0b11000000) === 0b11000000) { // QOI_OP_RUN
          run = byte1 & 0b00111111
          break changingChecks
        }
        if ((byte1 & 0b11100000) === 0b10100000) { //above
          red = result[pixelPosition - 768]
          green = result[pixelPosition - 768 + 1]
          blue = result[pixelPosition - 768 + 2]
        }
      }

      const indexPosition = ((red * 3 + green * 5 + blue * 7) % 128) * 3
      index[indexPosition] = red
      index[indexPosition + 1] = green
      index[indexPosition + 2] = blue
    }

    result[pixelPosition] = red
    result[pixelPosition + 1] = green
    result[pixelPosition + 2] = blue
  }

  return result
}