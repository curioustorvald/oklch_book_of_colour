"use strict";


class Lch { // OKLCH
    l;c;h;
    constructor(luma, chroma, hue) {
        if ([luma,chroma,hue].some(it=>it===undefined)) throw Error()
        this.l = luma // 0-100
        this.h = hue // 0-360
        this.c = chroma // 0-100
    }

    static xyzToLab(X_, Y_, Z_) {
        if (Y_ === undefined || Z_ === undefined) throw Error("Illegal param")
        // FIXME D65 only!

        let l = Math.pow(0.8189330101*X_ + 0.3618667424*Y_ - 0.1288597137*Z_, 0.333333333333)
        let m = Math.pow(0.0329845436*X_ + 0.9293118715*Y_ + 0.0361456387*Z_, 0.333333333333)
        let s = Math.pow(0.0482003018*X_ + 0.2643662691*Y_ + 0.6338517070*Z_, 0.333333333333)

        let L = 0.2104542553*l + 0.7936177850*m - 0.0040720468*s
        let a = 1.9779984951*l - 2.4285922050*m + 0.4505937099*s
        let b = 0.0259040371*l + 0.7827717662*m - 0.8086757660*s

        return [L, a, b]
    }

    static labToXyz(L, a, b) { // 0-1, -1-1, -1-1
        if (a === undefined || b === undefined) throw Error("Illegal param")
        if (L < 0.000001) return [0.0, 0.0, 0.0]
        // FIXME D65 only!

        let l = Math.pow(0.99999999845051981432*L + 0.39633779217376785678*a + 0.21580375806075880339*b, 3.0)
        let m = Math.pow(1.0000000088817607767*L - 0.1055613423236563494*a - 0.063854174771705903402*b, 3.0)
        let s = Math.pow(1.0000000546724109177*L - 0.089484182094965759684*a - 1.2914855378640917399*b, 3.0)

        let X = 1.227013851103521026*l - 0.5577999806518222383*m + 0.28125614896646780758*s
        let Y = -0.040580178423280593977*l + 1.1122568696168301049*m - 0.071676678665601200577*s
        let Z = -0.076381284505706892869*l - 0.42148197841801273055*m + 1.5861632204407947575*s

        return [X, Y, Z]
    }
    /**
     * @param rgbModel usually `rgbModels.sRGB` or something
     */
    static fromRGB(rgbModel, r, g, b) {
        let [x, y, z] = rgbModel.toXYZ(r, g, b)
        let [l, u, v] = Lch.xyzToLab(x, y, z)

        let c = Math.pow(u*u + v*v, 0.5)
        let h = Math.atan2(v,u) * 180.0 / Math.PI

        while (h < 0) h += 360.0

        // console.log("rgb->xyz",x,y,z)
        // console.log("rgb->xyz->luv",l,u,v)
        // console.log("rgb->xyz->luv->lch",l,c,h)

        return new Lch(l, c, h)
    }

    toRGB(rgbModel) {
        let hrad = this.h * Math.PI / 180.0
        let u = this.c * Math.cos(hrad)
        let v = this.c * Math.sin(hrad)
        let [x, y, z] = Lch.labToXyz(this.l, u, v)
        let [r, g, b] = rgbModel.fromXYZ(x, y, z)

        // console.log("hsl->lch", this.l, this.c, this.h)
        // console.log("hsl->lch->luv", this.l, u, v)
        // console.log("hsl->lch->luv->xyz", x, y, z)
        // console.log("hsl->lch->luv->xyz->rgb", r, g, b)

        return [r, g, b]
    }

    toLuv() {
        let hrad = this.h * Math.PI / 180.0
        let u = this.c * Math.cos(hrad)
        let v = this.c * Math.sin(hrad)
        return [this.l, u, v]
    }
}


const canvasColourSpace = {
    "sRGB": "srgb",
    "AppleP3": "display-p3",
    "AdobeRGB": "a98-rgb", // currently unsupported!! draft is available at: https://github.com/w3c/ColorWeb-CG/blob/master/index.html
    "Rec2020": "rec-2020" // currently unsupported!! draft is available at: https://github.com/w3c/ColorWeb-CG/blob/master/index.html
}

const gradMap = [[]]

function updatePicker() {}

function updateGradview(hue) {
    let ctxR = document.getElementById("gradviewR").getContext("2d", { colorSpace: canvasColourSpace[rgbModel] })
    let ctxL = document.getElementById("gradviewL").getContext("2d", { colorSpace: canvasColourSpace[rgbModel] })

    fillGrad(ctxR, hue)
    fillGrad(ctxL, (hue + 180) % 360)
}

const chromaMax = 0.42

function fillGrad(ctx, hue) {
    const xSteps = 6
    const ySteps = 30

    const xMaxSteps = GRAD_SIZE / xSteps
    const yMaxSteps = GRAD_SIZE / ySteps

    const rgb = rgbModels[rgbModel]

    const cullPoints = culldata[hue]

    // draw colours
    for (let y = 0; y <= yMaxSteps; y++) {
        gradMap[y] = []
        let y0 = ySteps*(y-1)
        let y1 = ySteps*y
        let y2 = ySteps*(y+1)
        let lightness = (y1)/GRAD_SIZE

        for (let x = 0; x <= xMaxSteps; x++) {
            let x0 = xSteps*(x-1)
            let x1 = xSteps*x
            let x2 = xSteps*(x+1)

            let chroma = (((x1+x2)/2.0)/GRAD_SIZE)*chromaMax

            let col = new Lch(lightness, chroma, hue).toRGB(rgb)
            gradMap[y][x] = col

            if (y>0 && x>0) {
                const fill1 = `rgb(
                    ${255.0 * gradMap[y-1][x-1][0]},
                    ${255.0 * gradMap[y-1][x-1][1]},
                    ${255.0 * gradMap[y-1][x-1][2]}
                )`
                const fill2 = `rgb(
                    ${255.0 * gradMap[y][x-1][0]},
                    ${255.0 * gradMap[y][x-1][1]},
                    ${255.0 * gradMap[y][x-1][2]}
                )`
                const vgrad = ctx.createLinearGradient(0,y0,0,y1)
                vgrad.addColorStop(0.0, fill1)
                vgrad.addColorStop(1.0, fill2)

                ctx.fillStyle = vgrad
                ctx.fillRect(x0,y0,x1,y1)
            }
        }
    }


    // then cull them
    let oldComposite = ctx.globalCompositeOperation

    ctx.globalCompositeOperation = "destination-out"
    ctx.fillStyle = "rgba(0,0,0,1.0)"
    ctx.beginPath()
    ctx.moveTo(0,0)
    for (let i = 0; i <= 100; i++) {
        let p = (i != 0 && i != 100) ? 0.25*cullPoints[i-1]+0.5*cullPoints[i]+0.25*cullPoints[i+1] : 0.0
        let y = i / 100 * GRAD_SIZE
        let x = GRAD_SIZE / chromaMax * p
        ctx.lineTo(x, y)
    }
    ctx.lineTo(0, GRAD_SIZE)
    ctx.lineTo(GRAD_SIZE, GRAD_SIZE)
    ctx.lineTo(GRAD_SIZE, 0)
    ctx.closePath()
    ctx.fill()
    ctx.globalCompositeOperation = "source-over"

}

