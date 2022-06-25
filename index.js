import canvasModule from "canvas"
const { createCanvas, loadImage } = canvasModule
import { encodeChunk, decodeChunk } from "./compression.js"
import sharp from "sharp"

//this script runs some benchmark testing, comparing PNG to this modified QOI format
//file size will be the same in other languages assuming you use the same compression level in PNG, however timing may vary significantly between languages

let benchmarkEncodeTime = 0
let benchmarkEncodeSize = 0
let benchmarkDecodeTime = 0

let customEncodeTime = 0
let customEncodeSize = 0
let customDecodeTime = 0

//10 runs pretty slowly, you can change this to 3 or lower to get faster (but less accurate) results.
let kiloPixelRange = 10

let count = 0
for (let x = -kiloPixelRange; x < kiloPixelRange; x++) {
  for (let y = -kiloPixelRange; y < kiloPixelRange; y++) {
    const imageData = await loadImage(`./images/${x}_${y}.png`)
    const canvas = createCanvas(imageData.width, imageData.height)
    const ctx = canvas.getContext("2d")
    ctx.drawImage(imageData, 0, 0)
    for (let x2 = 0; x2 < 4; x2++) {
      for (let y2 = 0; y2 < 4; y2++) {
        count++
        const imageData4Channels = Buffer.from(ctx.getImageData(x2 * 256, y2 * 256, 256, 256).data)
        const imageData3Channels = Buffer.alloc(imageData4Channels.length / 4 * 3)
        for (let i = 0; i < imageData4Channels.length; i += 4) {
          imageData3Channels[i / 4 * 3] = imageData4Channels[i]
          imageData3Channels[i / 4 * 3 + 1] = imageData4Channels[i + 1]
          imageData3Channels[i / 4 * 3 + 2] = imageData4Channels[i + 2]
        }
        
        
        //png
        let start = performance.now()
        let encoded = await sharp(imageData3Channels, {
          raw: {
            width: 256,
            height: 256,
            channels: 3
          }
        }).png({
          lossless: true,
          //this is generally a good balance between speed and file size but you can play around with the value (1-10)
          //custom QOI still has smaller average file sizes in all cases
          effort: 5
        }).toBuffer()
        benchmarkEncodeTime += performance.now() - start
        benchmarkEncodeSize += encoded.length
        start = performance.now()
        let decoded = await sharp(encoded).toBuffer()
        benchmarkDecodeTime += performance.now() - start
        
        
        //custom
        start = performance.now()
        let encoded2 = encodeChunk(imageData3Channels)
        customEncodeTime += performance.now() - start
        customEncodeSize += encoded2.length
        start = performance.now()
        let decoded2 = decodeChunk(encoded2)
        customDecodeTime += performance.now() - start
        //check if contents of decoded2 are identical to imageData3Channels
        //basically verifying that my custom compression works without errors
        for (let i = 0; i < imageData3Channels.length; i++) {
          if (imageData3Channels[i] !== decoded2[i]) {
            console.log("error", i)
            console.log(imageData3Channels[i], decoded2[i])
            process.exit()
          }
        }
      }
    }
  }
  console.log(`progress: encodeTime: ${customEncodeTime / count}, size: ${customEncodeSize / count}, decodeTime: ${customDecodeTime / count}`)
}
/*
let testImage = Buffer.alloc(256 * 256 * 3)
testImage.fill(255)
console.time("test")
const encoded = customEncode(testImage)
console.timeEnd("test")
console.log("test", encoded)
*/
console.log(`chunks tested: ${count}`)
console.log(`benchmark: encodeTime: ${benchmarkEncodeTime / count}, size: ${benchmarkEncodeSize / count}, decodeTime: ${benchmarkDecodeTime / count}`)
console.log(`custom: encodeTime: ${customEncodeTime / count}, size: ${customEncodeSize / count}, decodeTime: ${customDecodeTime / count}`)