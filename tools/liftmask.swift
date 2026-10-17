import Foundation
import Vision
import CoreImage

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: liftmask <in> <outmask.png>"); exit(1) }
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
guard let ci = CIImage(contentsOf: inURL, options: [.applyOrientationProperty: true]) else { print("load failed"); exit(1) }
let handler = VNImageRequestHandler(ciImage: ci)
let req = VNGenerateForegroundInstanceMaskRequest()
do {
    try handler.perform([req])
    guard let res = req.results?.first else { print("no subject"); exit(2) }
    print("instances:", res.allInstances.count)
    let buf = try res.generateScaledMaskForImage(forInstances: res.allInstances, from: handler)
    let mask = CIImage(cvPixelBuffer: buf)
    let ctx = CIContext()
    try ctx.writePNGRepresentation(of: mask, to: outURL, format: .L8, colorSpace: CGColorSpaceCreateDeviceGray())
    print("ok", mask.extent)
} catch { print("error", error); exit(3) }
