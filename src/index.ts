const https = require('https')

class LineAPI {

  private readonly hostname: string = 'api.line.me'

  constructor () {
  }

  /**
   * [getContent コンテンツを取得する]
   * @param  {number}       id [メッセージID]
   * @return {Promise<any>}    [Promise]
   */
  public getContent (id: number): Promise<any> {
    console.log(`Message ID: ${id}`)
    return new Promise((resolve, reject) => {
      const req = https.request({
        'hostname': this.hostname,
        'path': `/v2/bot/message/${id}/content`,
        'method': 'GET',
        'headers': {
          'Authorization': LINE_CHANNEL_ACCESS_TOKEN
        }
      }, (res) => {
        log(res)
        let buffers: Buffer[] = []
        res.on('data', (buffer: Buffer) => {
          buffers[buffers.length] = buffer
        })
        res.on('end', () => {
          console.log('got image')
          resolve(Buffer.concat(buffers))
        })
      })
      req.end()
    })
  }

  /**
   * [sedReply 応答メッセージを送る]
   * @param  {string}       replyToken [Webhook で受信する replyToken]
   * @param  {string}       text       [応答メッセージを]
   * @return {Promise<any>}            [Promise]
   */
  public sedReply (replyToken: string, text: string): Promise<any> {
    console.log(`Reply Token: ${replyToken}`)
    const replyJSON = JSON.stringify({
      'replyToken': replyToken,
      'messages': [
        {
          'type': 'text',
          'text': text
        }
      ]
    })
    return new Promise((resolve, reject) => {
      const req = https.request({
        'hostname': this.hostname,
        'path': '/v2/bot/message/reply',
        'method': 'POST',
        'headers': {
          'Content-Type': 'application/json',
          'Content-Length': replyJSON.length,
          'Authorization': LINE_CHANNEL_ACCESS_TOKEN
        }
      }, (res) => {
        log(res)
        let reply: string = ''
        res.on('data', (chunk: string) => {
          reply += chunk
        })
        res.on('end', () => {
          console.log('sended reply')
          resolve(reply);
        })
      })
      req.write(replyJSON)
      req.end()
    })
  }
}

class GoogleApi {

  private readonly hostname: string = 'www.googleapis.com'

  constructor () {
  }

  /**
   * [getAccessToken アクセストークンを取得する]
   * @return {Promise<any>} [Promise]
   */
  public getAccessToken (): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.request({
        'hostname': this.hostname,
        'path': `/oauth2/v4/token?refresh_token=${REFRESH_TOKEN}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=refresh_token`,
        'method': 'POST'
      }, (res) => {
        log(res)
        let jsonString: string = ''
        res.on('data', (chunk: string) => {
          jsonString += chunk
        })
        res.on('end', () => {
          console.log(`got json: ${jsonString}`)
          resolve(JSON.parse(jsonString))
        })
      })
      req.end()
    })
  }
}

class PicasaApi {

  private readonly hostname: string = 'picasaweb.google.com'

  constructor () {
  }

  /**
   * [uploadImage 画像アップロード]
   * @param  {string}       accessToken [アクセストークン]
   * @param  {number}       timestamp   [タイムスタンプ（画像のファイル名に使います）]
   * @param  {binary}       image       [画像ファイル]
   * @return {Promise<any>}             [Promise]
   */
  public uploadImage (accessToken: string, timestamp: number, image): Promise<any> {
    console.log(`Access Token: ${accessToken}`)
    console.log(`Time Stamp: ${timestamp}`)
    console.log(`Image Length: ${image.length}`)
    return new Promise((resolve, reject) => {
      const req = https.request({
        'hostname': this.hostname,
        'path': `/data/feed/api/user/${PICASA_USER_ID}/albumid/${PICASA_ALBUM_ID}?access_token=${accessToken}`,
        'method': 'POST',
        'headers': {
          'Content-Type': 'image/jpeg',
          'Content-Length': image.length,
          'Slug': `${timestamp}.jpg`,
        }
      }, (res) => {
        log(res)
        let result: string = ''
        res.on('data', (chunk: string) => {
          result += chunk
        })
        res.on('end', () => {
          console.log(`uploaded image: ${result}`)
          resolve(result)
        })
      })
      req.write(image)
      req.end()
    })
  }
}

/**
 * [log ログを取ります]
 * @param  {anny} res [レスポンスオブジェクト]
 */
function log(res) {
  console.log(`status: ${res.statusCode}`)
  console.log(`headers: ${JSON.stringify(res.headers)}`)
}

// 実行する関数を exec とします
exports.exec = async (req, res) => {
  if (req.body.events && req.body.events[0].message && req.body.events[0].message.type === 'image') {

    console.log(req.body.events[0]);
    const id = req.body.events[0].message.id;
    const timestamp = req.body.events[0].timestamp;
    const replyToken = req.body.events[0].replyToken;

    const line = new LineAPI()
    const google = new GoogleApi()
    const picasa = new PicasaApi()

    const image = await line.getContent(id)
    const json = await google.getAccessToken()

    await picasa.uploadImage(json.access_token, timestamp, image)
    await line.sedReply(replyToken, 'Thank you !!! uploaded Google Photos.')

    res.status(200).send('Success');
  } else {
    res.status(400).send('No message defined!');
  }
}
