const fs = require('fs')
const JSONStream = require('JSONStream')
const moment = require('moment-timezone')
const through = require('through2')
const colorspace = require('colorspace')
const Canvas = require('canvas')
const LastfmExportStream = require('lastfmexportstream')
// const LastFM = require('last-fm')

// const API_KEY = '7906a0f41ca90b95bce3ca35f6f245df'
// const USER_AGENT = 'ListenViz/1.0.0 (https://rabid.audio)'

// // const lastfm = new LastFM(API_KEY, { userAgent: USER_AGENT })

// listens.pipe(through.obj(function (track, enc, callback) {
//   console.log(track)
//   foo.push(track)
//   callback()
// })).on('finish', () => fs.writeFileSync('scrobbles.json', JSON.stringify(foo)))

class ImageBuilder {
  constructor (opts = {}) {
    opts.username = opts.username || 'rabidaudio'
    opts.scaleFactor = opts.scaleFactor || 1
    opts.timezone = opts.timezone || 'America/New_York'
    opts.start = opts.start || moment().tz(opts.timezone)
    opts.start.startOf('day') // round to whole days
    opts.end = opts.end || opts.start.clone().subtract(1, 'year')
    opts.end.startOf('day') // round to whole days
    opts.blockSize = opts.blockSize || moment.duration(15, 'minutes')
    // minimum 1 day, since we want to round to whole days
    opts.rowTime = opts.rowTime || moment.duration(1, 'day')
    this.opts = opts
    this.blockTags = {}
    const width = Math.floor(opts.scaleFactor * (opts.rowTime / opts.blockSize))
    const height = Math.floor(opts.scaleFactor * (opts.start.diff(opts.end) / opts.rowTime))
    this.canvas = Canvas.createCanvas(width, height)
    this.context = this.canvas.getContext('2d')
    this.context.fillStyle = 'white'
    this.context.fillRect(0, 0, width, height)
  }

  getScrobbleStream () {
    // TODO using filesystem for testing
    return fs.createReadStream('scrobbles.json')
      .pipe(JSONStream.parse('*'))
    // return new LastfmExportStream({
    //   apiKey: API_KEY,
    //   user: this.opts.username,
    //   reverse: true,
    //   from: this.opts.start.valueOf(),
    //   to: this.opts.end.valueOf()
    // })
  }

  onTrack (track, enc, callback) {
    // this.getTags(track.artist).then(tags => {
    //   const block = this.getTimeBock(track.time)
    //   tags[block.id] = tags[block.id] || []
    //   tags[block.id] = tags[block.id].concat(tags)
    //   this.setColor(block, this.getColor(tags[block.id]))
    //   callback()
    // })
    const block = this.getTimeBock(track.time)
    // const color = colorspace([track.artist, track.album, track.title].join(':'))
    const color = '#3c444f'
    this.setColor(block, color)
    callback()
  }

  createImage (callback) {
    this.getScrobbleStream()
      .pipe(through.obj(this.onTrack.bind(this)))
      .on('finish', () => callback(this.canvas.createPNGStream()))
  }

  async getTags (artist) {
    // TODO
    return ['tag']
  }

  getTimeBock (unixTime) {
    const listenTime = moment(unixTime).tz(this.opts.timezone)
    const startOfDay = listenTime.clone().startOf('day')
    const secondsOfDay = listenTime.diff(startOfDay)
    return {
      id: listenTime.clone().subtract(secondsOfDay % this.opts.blockSize).valueOf(),
      x: Math.floor(secondsOfDay / this.opts.blockSize),
      y: Math.floor(this.opts.start.diff(startOfDay) / this.opts.rowTime)
    }
  }

  setColor (coord, color) {
    const scale = this.opts.scaleFactor
    this.context.fillStyle = color
    this.context.fillRect(coord.x * scale, coord.y * scale, scale, scale)
  }
}

new ImageBuilder({ scaleFactor: 4 })
  .createImage((pngStream) => pngStream.pipe(fs.createWriteStream('out.png')))
