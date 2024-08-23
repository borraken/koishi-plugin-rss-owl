import { Context, Session, Logger, Schema, MessageEncoder, h } from 'koishi'
import axios from 'axios'
import * as cheerio from 'cheerio';
import { } from 'koishi-plugin-puppeteer'
import { } from '@koishijs/censor'
// import { } from '@koishijs/assets'
const X2JS = require("x2js")
const x2js = new X2JS()
const logger = new Logger('rss-owl')
export const name = 'RSS-OWL'
import { pathToFileURL } from 'url'
import * as fs from 'fs';
import * as path from 'path';
export const inject = { required: ["database"], optional: ["puppeteer", "censor"] }

declare module 'koishi' {
  interface rssOwl {
    id: string | number
    url: string
    platform: string
    guildId: string
    author: string
    rssId: number
    arg: rssArg,
    title: string
    lastPubDate: number
  }
}

interface Config {
  basic?: BasicConfig
  template?: TemplateConfig
  net?: NetConfig
  msg?: MsgConfig
  debug?: boolean
}

interface BasicConfig {
  defaultTemplate?: 'content' | 'only text' | 'only image' | 'proto' | 'default' | 'only description' | 'custom' | 'link'
  timeout?: number
  refresh?: number
  merge?: '不合并' | '有多条更新时合并' | '一直合并'
  maxRssItem?: number
  firstLoad?: boolean
  urlDeduplication?: boolean
  imageMode?: 'base64' | 'File'
  videoMode?: 'filter'|'href'|'base64' | 'File'
  autoSplitImage?: boolean
  cacheDir?: string
  replaceDir?: string
}

interface TemplateConfig {
  bodyWidth?: number
  bodyPadding?: number
  custom?: string
}

interface NetConfig {
  userAgent?: string
  proxyAgent?: proxyAgent
}
interface MsgConfig {
  censor?: boolean
  keywordFilter?: Array<string>
  keywordBlock?: Array<string>
  rssHubUrl?:string
}

interface proxyAgent {
  enabled?: boolean
  protocol?: string
  host?: string,
  port?: number
  auth?: auth
}
interface auth {
  enabled: boolean
  username: string
  password: string
}

export interface rss {
  url: string
  id: string | number
  arg: rssArg,
  title: string
  author: string
  lastPubDate: number
}
export interface rssArg {
  template?: 'content' | 'only text' | 'only image' | 'only video' | 'proto' | 'default' | 'only description' | 'custom' | 'link'
  content: string | never

  forceLength?: number
  timeout?: number
  refresh?: number
  reverse?: boolean

  firstLoad?: boolean
  merge?: boolean
  maxRssItem?: number
  proxyAgent?: proxyAgent
  bodyWidth?: number
  bodyPadding?: number
  filter?: Array<string>
  block?: Array<string>
  // customUrlEnable?: boolean



  split?:number

  nextUpdataTime?: number
}
// export const usage = ``
const templateList = ['content', 'only text', 'only image', 'only video', 'proto', 'default', 'only description', 'custom','link']

export const Config = Schema.object({
  basic: Schema.object({
    defaultTemplate: Schema.union(templateList).description('默认消息解析模板 <br> \`content\` 基础图文模板，图片过多时可能出现问题，无需puppeteer<br>\`only text\` 仅推送文字，无需puppeteer<br>\`only image\` 仅推送图片，无需puppeteer<br>\`only video\` 仅推送视频，无需puppeteer<br>\`proto\` 推送原始内容，无需puppeteer<br>\`default\` puppeteer模板，包含title等信息<br>\`only description\` puppeteer模板，仅包含description内容<br>\`custom\` 自定义puppeteer模板，见下方模板设置<br>\`link\` puppeteer模板，截图description中首个a标签网站<br>在订阅时使用自定义配置时无需only字段，例:`rsso -i text <url>`使用only text模板')
      .default('content'),
    timeout: Schema.number().description('请求数据的最长时间（秒）').default(60),
    refresh: Schema.number().description('刷新订阅源的时间间隔（秒）').default(600),
    merge: Schema.union(['不合并', '有多条更新时合并', '一直合并']).description('合并消息规则').default('有多条更新时合并'),
    maxRssItem: Schema.number().description('限制更新时的最大推送数量上限，超出上限时较早的更新会被忽略').default(10),
    firstLoad: Schema.boolean().description('首次订阅时是否发送最后的更新').default(true),
    urlDeduplication: Schema.boolean().description('同群组中不允许重复添加相同订阅').default(true),
    imageMode: Schema.union(['base64', 'File']).description('图片发送模式，使用File可以解决部分图片无法发送的问题，但无法在沙盒中使用').default('base64'),
    videoMode: Schema.union(['filter','href','base64', 'File']).description('视频发送模式（iframe标签内的视频无法处理）<br> \`filter\` 过滤视频，含有视频的推送将不会被发送<br> \`href\` 使用视频网络地址直接发送<br> \`base64\` 下载后以base64格式发送<br> \`File\` 下载后以文件发送').default('href'),
    autoSplitImage: Schema.boolean().description('自动垂直拆分大尺寸图片以避免发送限制').default(true),
    cacheDir: Schema.string().description('File模式时使用的缓存路径').default('data/cache/rssOwl'),
    replaceDir: Schema.string().description('缓存替换路径，仅在使用docker部署时需要设置').default(''),
  }).description('基础设置'),
  template: Schema.object({
    bodyWidth: Schema.number().description('puppeteer图片的宽度(px)，较低的值可能导致排版错误，仅在内置模板生效').default(600),
    bodyPadding: Schema.number().description('puppeteer图片的内边距(px)，仅在内置模板生效').default(20),
    custom: Schema.string().role('textarea', { rows: [4, 2] }).default(`<body style="width:400px;padding:20px;background:#F5ECCD;">
      <div style="display: flex;flex-direction: column;">
          <div style="backdrop-filter: blur(5px) brightness(0.7) grayscale(0.1);display: flex;align-items: center;flex-direction: column;border-radius: 10px;border: solid;overflow:hidden">
              <div style="display: flex;align-items: center;">
                  <img src="{{rss.channel.image.url}}" style="margin-right: 10px;object-fit: scale-down;max-height: 160px;max-width: 160px;" alt="" srcset="" />
                  <p style="font-size: 20px;font-weight: bold;color: white;">{{rss.channel.title}}</p>
              </div>
              <p style="color: white;font-size: 16px;">{{rss.channel.description}}</p>
          </div>
          <div style="font-weight: bold;">{{title}}:{{pubDate}}</div>
          <div style="">{{description}}</div>
      </div>
  </body>`).description('custom的内容，需要puppeteer'),
  }).description('模板设置'),
  net: Schema.object({
    proxyAgent: Schema.intersect([
      Schema.object({ enabled: Schema.boolean().default(false).description('使用代理'), }),
      Schema.union([Schema.object({
        enabled: Schema.const(true).required(),
        protocol: Schema.union(['http', 'https', 'socks5']).default('http'),
        host: Schema.string().role('link').default('127.0.0.1'),
        port: Schema.number().default(7890),
        auth: Schema.intersect([
          Schema.object({ enabled: Schema.boolean().default(false), }),
          Schema.union([Schema.object({
            enabled: Schema.const(true).required(),
            username: Schema.string(),
            password: Schema.string(),
          }), Schema.object({}),]),
        ])
      }), Schema.object({}),]),
    ]),
    userAgent: Schema.string(),
  }).description('网络设置'),
  msg: Schema.object({
    rssHubUrl:Schema.string().role('link').description('使用快速订阅时rssHub的地址').default('https://rsshub.app'),
    keywordFilter: Schema.array(Schema.string()).role('table').description('关键字过滤，使用正则检查title和description中的关键字，含有关键字的推送不会发出，不区分大小写').default(['nsfw']),
    keywordBlock: Schema.array(Schema.string()).role('table').description('关键字屏蔽，内容中的正则关键字会被删除，不区分大小写').default(['^nsfw$']),
    censor: Schema.boolean().description('消息审查，需要censor服务').default(false).experimental(),
  }).description('消息处理'),
  // customUrlEnable:Schema.boolean().description('开发中：允许使用自定义规则对网页进行提取，用于对非RSS链接抓取').default(false).experimental(),
  debug: Schema.boolean().description('调试开关').default(false),
})

export function apply(ctx: Context, config: Config) {
  ctx.model.extend(('rssOwl' as any), {
    id: {
      type: "integer",
      length: 65535
    },
    url: "text",
    platform: "string",
    guildId: "string",
    author: "string",
    rssId: {
      type: "integer",
      length: 65535
    },
    arg: "json",
    title: "string",
    lastPubDate: "timestamp",
  }, {
    autoInc: true
  }
  )
  const getDefaultTemplate = (bodyWidth, bodyPadding) => `<body style="width:${bodyWidth || config.template.bodyWidth}px;padding:${bodyPadding || config.template.bodyPadding}px"><h3>{{title}}</h3><h5>{{pubDate}}</h5><br><div>{{description}}<div></body>`
  const getDescriptionTemplate = (bodyWidth, bodyPadding) => `<body style="width:${bodyWidth || config.template.bodyWidth}px;padding:${bodyPadding || config.template.bodyPadding}px">{{description}}</body>`
  let interval
  const debug = (message) => config.debug && logger.info(message)

  //   async function sendMessageToChannel(ctx, guild, broadMessage) {
  //     const targetChannels = await ctx.database.get("channel", guild);
  //     debug("sendMessageToChannel")
  //     debug(guild)
  //     debug(targetChannels)
  //     if (targetChannels.length === 1) {
  //         const bot = ctx.bots.find((bot) => bot.userId === targetChannels[0].assignee);
  //         if (bot) {
  //             await bot.sendMessage(guild.guildId, broadMessage);
  //         } else {
  //             throw new Error("指定的bot未找到。");
  //         }
  //     } else if (targetChannels.length > 1) {
  //         throw new Error("有复数个bot存在于该群组/频道，请移除多余bot。");
  //     } else {
  //         throw new Error("未找到目标群组/频道。");
  //     }
  // }
  // const __dirname = './cache'
  const getImageUrl = async (url, arg,useBase64Mode=false) => {
    let res
    res = await $http(url, arg, { responseType: 'arraybuffer' })
    debug(res.data)
    let prefixList = ['png', 'jpeg', 'webp']
    let prefix = res.headers["content-type"] || ('image/' + (prefixList.find(i => new RegExp(i).test(url)) || 'jpeg'))
    let base64Prefix = `data:${prefix};base64,`
    let base64Data = base64Prefix + Buffer.from(res.data, 'binary').toString('base64')
    if (config.basic.imageMode == 'base64'||useBase64Mode) {
      // console.log(base64Img);
      return base64Data
    } else if (config.basic.imageMode == 'File') {
      let fileUrl = await writeCacheFile(base64Data)
      return fileUrl
    }
    // let res = await $http(url,arg,{responseType: 'blob'})
    // let file = new File([res.data], "name");
  }
  const getVideoUrl = async (url, arg,useBase64Mode=false,dom) => {
    debug(dom.children);
    let src = dom.attribs.src || dom.children["0"].attribs.src
    let res
    if(config.basic.videoMode == "href"){
      return src
    }else{
      res = await $http(src, arg, { responseType: 'arraybuffer' })
      let prefix = res.headers["content-type"] 
      let base64Prefix = `data:${prefix};base64,`
      let base64Data = base64Prefix + Buffer.from(res.data, 'binary').toString('base64')
      if (config.basic.videoMode == 'base64') {
        return base64Data
      } else if (config.basic.videoMode == 'File') {
        let fileUrl = await writeCacheFile(base64Data)
        return fileUrl
      }
    }
  }
  const puppeteerToFile = async (puppeteer: string) => {
    let base64 = /(?<=src=").+?(?=")/.exec(puppeteer)[0]
    const buffer = Buffer.from(base64.substring(base64.indexOf(',') + 1), 'base64');
    // console.log("Byte length: " + buffer.length);
    const MB = buffer.length / 1e+6
    debug("MB: " + MB);
    return `<file src="${await writeCacheFile(base64)}"/>`
  }
  const quickList = [
    {prefix:"rss",name:"rsshub通用订阅",detail:"rsshub通用快速订阅，用于快速写入及通过配置动态更换rsshub地址",explain:"rss:param1/param2/...",example:"rss:apnews/rss/business",argLength:[1,9],replace:"$1$2$3$4$5$6$7$8$9"},
    {prefix:"tg",name:"电报频道",detail:"输入电报频道信息中的链接地址最后部分",explain:"tg:[:channel_name]",example:"tg:woshadiao",argLength:[1,1],replace:"/telegram/channel$1"},
    {prefix:"mp-tag",name:"微信公众平台话题TAG",detail:"一些公众号（如看理想）会在微信文章里添加 Tag，点入 Tag 的链接如 https://mp.weixin.qq.com/mp/appmsgalbum?__biz=MzA3MDM3NjE5NQ==&action=getalbum&album_id=1375870284640911361，输入__biz和album_id",explain:"mp-tag:[:__biz]/[:album_id]",example:"mp-tag:MzA3MDM3NjE5NQ==/1375870284640911361",argLength:[2,2],replace:"/wechat/mp/msgalbum$1$2"},
    {prefix:"gh",name:"github相关",detail:"Repo Issue:gh:issue/[:user]/[:repo]/[:state?(open|closed|all)]/[:labels?(open|bug|...)]\nRepo Stars:gh:stars/[:user]/[:repo]\nTrending:gh:trending/[:since(daliy|weekly|monthly)]/[:language?(javascript|c#|c++|...)]/[:spoken_language?(English|Chinese|...)]\nUser Activities:gh:activity/[:user]",explain:"gh:[type]/[param1]/[param2]...",example:"gh:issue/koishijs/koishi/open",argLength:[2,5],replace:"/github$1$2$3$4$5"},
  ]
  const parseQuickUrl = (url)=>{
    let correntQuickObj = quickList.find(i=>new RegExp(`^${i.prefix}:`).test(url))
    if(!correntQuickObj)return url
    let params = url.match(new RegExp(`(?<=^${correntQuickObj.prefix}:).*`))[0].split("/")
    if(params.length<correntQuickObj.argLength[0]||params.length>correntQuickObj.argLength[1]){
      throw new Error("amount of params is wrong")
    }
    let rUrl = correntQuickObj.replace.replace(/\$\d/g,v=>{
      let index = +(v.match(/\$(.*)/)[1])-1
      return params[index]?`/${params[index]}`:""
    })
    debug(config.msg.rssHubUrl + rUrl)
    return config.msg.rssHubUrl + rUrl
  }
  const getCacheDir = () => {
    let dir = config.basic.cacheDir ? path.resolve('./', config.basic.cacheDir || "") : `${__dirname}/cache`
    let mkdir = (path,deep=2)=>{
      let dir = path.split("\\").splice(0,deep).join("\\")
      let dirDeep = path.split("\\").length
      console.log(dir,dirDeep);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      return dirDeep>deep && mkdir(path,deep+1)
    }
    if (!fs.existsSync(dir)) {
      mkdir(dir)
    }
    return dir
  }
  const writeCacheFile = async (fileUrl: string) => {
    const cacheDir = getCacheDir()
    debug(cacheDir)
    let fileList = fs.readdirSync(cacheDir)
    let suffix = /(?<=^data:.+?\/).+?(?=;base64)/.exec(fileUrl)[0]
    let fileName = `${parseInt((Math.random() * 10000000).toString()).toString()}.${suffix}`
    while (fileList.find(i => i == fileName)) {
      fileName = `${parseInt((Math.random() * 10000000).toString()).toString()}.${suffix}`
    }
    let base64Data = fileUrl.replace(/^data:.+?;base64,/, "");
    let path = `${cacheDir}/${fileName}`
    debug(path);

    fs.writeFileSync(path, base64Data, 'base64')
    if (config.basic.replaceDir) {
      return `file:///${config.basic.replaceDir}/${fileName}`
    } else {
      return pathToFileURL(path).href
    }
  }
  const delCache = async () => {
    const cacheDir = getCacheDir()
    fs.readdirSync(cacheDir).forEach(file => {
      if(!!path.extname(file))fs.unlinkSync(path.join(cacheDir, file))
    })
    return
  }
  const sleep = (delay = 1000) => new Promise(resolve => setTimeout(resolve, delay));
  let maxRequestLimit = 1
  let requestRunning = 0
  const $http = async (url, arg, config = {}) => {
    while (requestRunning >= maxRequestLimit) {
      await sleep(1000)
    }
    requestRunning++
    let requestConfig = { timeout: arg.timeout * 1000 }
    // console.log(arg);
    // debug("http")
    let proxy = {}
    if (arg?.proxyAgent?.enabled) {
      proxy['proxy'] = {
        "protocol": arg.proxyAgent.protocol,
        "host": arg.proxyAgent.host,
        "port": arg.proxyAgent.port
      }
      if (arg?.proxyAgent?.auth?.enabled) {
        proxy['proxy']["auth"] = {
          username: arg.proxyAgent.auth.username,
          password: arg.proxyAgent.auth.password
        }
      }
    }
    if (arg.userAgent) {
      requestConfig['header'] = { 'User-Agent': arg.userAgent }
    }
    // debug(requestConfig);
    debug(`${url} : ${JSON.stringify({ ...requestConfig, ...config, ...proxy })}`)
    let res
    let retries = 3
    // debug({url, arg, config})
    while (retries > 0 && !res) {
      try {
        if (retries > 1) {
          res = await axios.get(url, { ...requestConfig, ...config, ...proxy })
        } else {
          // debug({ url, ...requestConfig, ...config })
          res = await axios.get(url, { ...requestConfig, ...config })
        }
      } catch (error) {
        retries--
        if (retries <= 0) {
          requestRunning--
          debug({url, arg, config})
          debug(error);

          throw error
        }
        await sleep(1000)
      }
    }
    requestRunning--
    return res
  }
  const renderHtml2Image = async (htmlContent:string)=>{
    let page = await ctx.puppeteer.page()
    //截图
    debug(htmlContent)
    await page.setContent(htmlContent)
    if(!config.basic.autoSplitImage)return h.image(await page.screenshot({type:"png"}),'image/png') 
    let [height,width,x,y] = await page.evaluate(()=>[document.body.offsetHeight,document.body.offsetWidth,parseInt(document.defaultView.getComputedStyle(document.body).marginLeft)||0,parseInt(document.defaultView.getComputedStyle(document.body).marginTop)||0])
    let size = 10000
    debug([height,width,x,y])
    const split = Math.ceil(height/size)
    if(!split)return h.image(await page.screenshot({type:"png",clip:{x,y,width,height}}),'image/png')
    debug({height,width,split})
    const reduceY =(index) =>{
      let y = Math.floor(height/split*index)
      return y
      // return index?(y-100):y
    }
    const reduceHeight =(index) =>{
      let h = Math.floor(height/split)
      return h
      // return (index==(split-1))?h:(h+100)
    }
    let imgData = await Promise.all(Array.from({length:split},async(v,i)=>await page.screenshot({type:"png",clip:{x,y:reduceY(i)+y,width,height:reduceHeight(i)}})))
    return imgData.map(i=>h.image(i,'image/png')).join("")
  }
  const getRssData = async (url, config) => {
    // let rssXML = await fetch(url)
    // let rssText = await rssXML.text()
    // let rssJson = x2js.xml2js(rssText)
    // console.log(rssXML);
    let res = (await $http(url, config)).data
    let rssJson = x2js.xml2js(res)
    debug(rssJson);
    rssJson.rss.channel.item = [rssJson.rss.channel.item].flat(Infinity)
    const rssItemList = rssJson.rss.channel.item.map(i => ({ ...i, rss: rssJson.rss }))
    return rssItemList
  }
  const parseRssItem = async (item: any, arg: rssArg, authorId: string | number) => {
    // debug(arg);
    // let messageItem = Object.assign({}, ...arg.rssItem.map(key => ({ [key]: item[key.split(":")[0]] ?? "" })))
    let template = arg.template
    let msg: string = ""
    let html
    let description: string = item.description?.join?.('') || item.description
    //block
    arg.block?.forEach(blockWord => description.replace(new RegExp(blockWord, 'gim'), i => Array(i.length).fill("*").join("")))
    // const pushVideo = (msg, html) => `${msg}${config.basic.videoFetch ? html('video').map((v, i) => i.attribs.src).map(i => `<video src="${i}"/>`).join() : ''}`
    // debug(template);
    if(config.basic.videoMode==='filter'){
      html = cheerio.load(description)
      html('video').length > 0
      return ''
    }
    if (template == "custom") {
      debug("custom");
      description = config.template.custom.replace(/{{(.+?)}}/g, i =>i.match(/^{{(.*)}}$/)[1].split(".").reduce((t, v) => new RegExp("Date").test(v) ? new Date(t?.[v]).toLocaleString() : t?.[v] || "", item))
      // debug(description);
      html = cheerio.load(description)
      if(arg?.proxyAgent?.enabled){
        debug("puppeteer:proxyAgent");
        await Promise.all(html('img').map(async(v,i)=>i.attribs.src = await getImageUrl(i.attribs.src,arg,true) )) 
      }
      html('img').attr('style', 'object-fit:scale-down;max-width:100%;')
      if(config.basic.imageMode=='base64'){
        msg = (await renderHtml2Image(html.xml())).toString()
      }else if(config.basic.imageMode=='File'){
        msg = await ctx.puppeteer.render(html.xml())
        msg = await puppeteerToFile(msg)
      }
      msg += (await Promise.all(html('video').map(async(v,i)=>await getVideoUrl(i.attribs.src,arg,true,i)))).map(src=>h.video(src)).join("")
      
    } else if (template == "content") {
      // debug("content");
      html = cheerio.load(description)
      let imgList = []
      html('img').map((key, i) => imgList.push(i.attribs.src))
      imgList = [...new Set(imgList)]
      // debug(imgList)
      let imgBufferList = Object.assign({}, ...(await Promise.all(imgList.map(async src => ({ [src]: await getImageUrl(src, arg) })))))
      // debug(imgBufferList)
      // imgList = await Promise.all(imgList.map(async ([key,i])=>({[key]:await getImageUrl(i, arg)}))) 
      html('img').replaceWith((key, Dom) => `<p>$img{{${imgList[key]}}}</p>`)
      msg = html.text()
      msg = msg.replace(/\$img\{\{(.*?)\}\}/g, match => {
        let src = match.match(/\$img\{\{(.*?)\}\}/)[1]
        return `<img src="${imgBufferList[src]}"/>`
      })
      msg = `${item?.title?`《${item?.title}》\n`:''}${msg}`
      msg += (await Promise.all(html('video').map(async(v,i)=>await getVideoUrl(i.attribs.src,arg,true,i)))).map(src=>h.video(src)).join("")
    } else if (template == "only text") {
      html = cheerio.load(description)
      msg = html.text()
    } else if (template == "only image") {
      html = cheerio.load(description)
      let imgList = await Promise.all([...html('img').map((v, i) => i.attribs.src)].map(async i => await getImageUrl(i.attribs.src, arg)))
      msg = imgList.map(img => `<img src="${img}"/>`).join("")
    } else if (template == "only video") {
      html = cheerio.load(description)
      msg = (await Promise.all(html('video').map(async(v,i)=>await getVideoUrl(i.attribs.src,arg,true,i)))).map(src=>h.video(src)).join("")
    } else if (template == "proto") {
      msg = description
    } else if (template == "default") {
      debug("default");
      description = getDefaultTemplate(config.template.bodyWidth, config.template.bodyPadding).replace(/{{(.+?)}}/g, i =>i.match(/^{{(.*)}}$/)[1].split(".").reduce((t, v) => new RegExp("Date").test(v) ? new Date(t?.[v]).toLocaleString() : t?.[v] || "", item))
      debug(description);
      html = cheerio.load(description)
      if(arg?.proxyAgent?.enabled){
        debug("puppeteer:proxyAgent");
        await Promise.all(html('img').map(async(v,i)=>i.attribs.src = await getImageUrl(i.attribs.src,arg,true) )) 
      }
      html('img').attr('style', 'object-fit:scale-down;max-width:100%;')
      if(config.basic.imageMode=='base64'){
        msg = (await renderHtml2Image(html.xml())).toString()
      }else if(config.basic.imageMode=='File'){
        msg = await ctx.puppeteer.render(html.xml())
        msg = await puppeteerToFile(msg)
      }
      if(config.basic.imageMode=='File')msg = await puppeteerToFile(msg)
      msg += (await Promise.all(html('video').map(async(v,i)=>await getVideoUrl(i.attribs.src,arg,true,i)))).map(src=>h.video(src)).join("")
    } else if (template == "only description") {
      // debug("only description");
      description = getDescriptionTemplate(config.template.bodyWidth, config.template.bodyPadding).replace(/{{(.+?)}}/g, i =>i.match(/^{{(.*)}}$/)[1].split(".").reduce((t, v) => new RegExp("Date").test(v) ? new Date(t?.[v]).toLocaleString() : t?.[v] || "", item))
      // debug(description);
      html = cheerio.load(description)
      if(arg?.proxyAgent?.enabled){
        debug("puppeteer:proxyAgent");
        await Promise.all(html('img').map(async(v,i)=>i.attribs.src = await getImageUrl(i.attribs.src,arg,true) )) 
      }
      html('img').attr('style', 'object-fit:scale-down;max-width:100%;')
      if(config.basic.imageMode=='base64'){
        msg = (await renderHtml2Image(html.xml())).toString()
      }else if(config.basic.imageMode=='File'){
        msg = await ctx.puppeteer.render(html.xml())
        msg = await puppeteerToFile(msg)
      }
      msg += (await Promise.all(html('video').map(async(v,i)=>await getVideoUrl(i.attribs.src,arg,true,i)))).map(src=>h.video(src)).join("")
    } else if (template == "link") {
      // debug("only description");
      html = cheerio.load(description)
      debug(html('a')[0].attribs)
      let src = html('a')[0].attribs.href
      let html2 = cheerio.load((await $http(src,arg)).data)
      if(arg?.proxyAgent?.enabled){
        debug("puppeteer:proxyAgent");
        await Promise.all(html2('img').map(async(v,i)=>i.attribs.src = await getImageUrl(i.attribs.src,arg,true) )) 
      }
      html2('img').attr('style', 'object-fit:scale-down;max-width:100%;')
      html2('body').attr('style', `width:${config.template.bodyWidth}px;padding:${config.template.bodyPadding}px;`)
      if(config.basic.imageMode=='base64'){
        msg = (await renderHtml2Image(html2.xml())).toString()
      }else if(config.basic.imageMode=='File'){
        msg = await ctx.puppeteer.render(html2.xml())
        msg = await puppeteerToFile(msg)
      }
    }
    // msg = pushVideo(msg, html)
    debug(msg);
    if (config.msg.censor) {
      return `<censor>${msg}</censor>`
    }
    return msg
  }
  const feeder = async () => {
    debug("feeder");
    const rssList = await ctx.database.get(('rssOwl' as any), {})
    // debug(rssList);
    for (const rssItem of rssList) {
      // console.log(`${rssItem.platform}:${rssItem.guildId}`);
      try {
        let arg: rssArg = mixinArg(rssItem.arg || {})
        if (rssItem.arg.refresh) {
          if (arg.nextUpdataTime > +new Date()) continue
          let nextUpdataTime = arg.nextUpdataTime + arg.refresh
          await ctx.database.set(('rssOwl' as any), { id: rssItem.id }, { nextUpdataTime })
        }
        try {
          let rssItemList = (await Promise.all(rssItem.url.split("|")
            .map(i=>parseQuickUrl(i))
            .map(async url => await getRssData(url, arg)))).flat(1)
          let itemArray = rssItemList.sort((a, b) => +new Date(b.pubDate) - +new Date(a.pubDate))
            .filter(item => !arg?.filter?.find(keyword => new RegExp(keyword, 'im').test(item.title) || new RegExp(keyword, 'im').test(item.description)))
  
          if (arg.reverse) {
            itemArray = itemArray.reverse()
          }
          // debug("itemArray");
          debug(itemArray[0]);
          let messageList, rssItemArray
          let lastPubDate = +new Date(itemArray[0].pubDate) || 0
          if (rssItem.arg.forceLength) {
            // debug("forceLength");
            rssItemArray = itemArray.filter((v, i) => i < arg.forceLength)
            messageList = await Promise.all(itemArray.filter((v, i) => i < arg.forceLength).map(async i => await parseRssItem(i, arg, rssItem.author)))
          } else {
            let rssItemArray = itemArray.filter((v, i) => (+new Date(v.pubDate) > rssItem.lastPubDate)).filter((v, i) => !arg.maxRssItem || i < arg.maxRssItem)
            if (!rssItemArray.length) continue
            debug(`${JSON.stringify(rssItem)}:共${rssItemArray.length}条新信息`);
            debug(rssItemArray.map(i => i.title));
            messageList = await Promise.all(rssItemArray.reverse().map(async i => await parseRssItem(i, arg, rssItem.author)))
          }
          let message
          if(!messageList.join(""))return
          if (arg.merge===true) {
            message = `<message forward><author id="${rssItem.author}"/>${messageList.join("")}</message>`
          } else if (arg.merge === false) {
            message = messageList.join("")
          } else if (config.basic.merge == "一直合并") {
            message = `<message forward><author id="${rssItem.author}"/>${messageList.map(i=>`<message>${i}</message>`).join("")}</message>`
          } else if (config.basic.merge == "不合并") {
            message = messageList.join("")
          } else if (config.basic.merge == "有多条更新时合并") {
            message = messageList.length > 1 ? `<message forward><author id="${rssItem.author}"/>${messageList.map(i=>`<message>${i}</message>`).join("")}</message>` : messageList.join("")
          }
          ctx.broadcast([`${rssItem.platform}:${rssItem.guildId}`], message)
          await ctx.database.set(('rssOwl' as any), { id: rssItem.id }, { lastPubDate })
        } catch (error) {
          logger.error(`更新失败:${JSON.stringify(rssItem)}`)
          logger.error(error)
        }
        
      } catch (error) {
        debug(error)
      }
    }
  }
  const formatArg = (options): rssArg => {
    let { arg, template, daily } = options
    let json = Object.assign({}, ...(arg?.split(',')?.map(i => ({ [i.split(":")[0]]: i.split(":")[1] })) || []))
    let key = ["forceLength", "reverse", "timeout", "refresh", "merge", "maxRssItem", "firstLoad", "bodyWidth", "bodyPadding", "custom", "proxyAgent", "auth", "filter", "block"]
    let booleanKey = ['firstLoad', 'merge']
    let numberKey = ['forceLength', "timeout",'refresh','maxRssItem','bodyWidth','bodyPadding']
    let falseContent = ['false', 'null', '']

    json = Object.assign({}, ...Object.keys(json).filter(i => key.some(key => key == i)).map(key => ({ [key]: booleanKey.some(bkey => bkey == key) ? falseContent.some(c => c == json[key]) : numberKey.some(nkey => nkey == key)?(+json[key]):json[key] })))


    // if (rssItem) {
    //   json['rssItem'] = rssItem.split(',')
    // }
    if (template && templateList.find(i => new RegExp(template).test(i))) {
      json['template'] = templateList.find(i => new RegExp(template).test(i))
    }
    if (daily) {
      json['refresh'] = 1440
      let forceLength = daily.split("/")?.[1]
      let [hour = 8, minutes = 0] = daily.split("/")[0].split(":").map(i => parseInt(i))
      minutes = minutes > 60 ? 0 : minutes < 0 ? 0 : minutes
      let date = new Date()
      let nowHours = date.getHours()
      nowHours > date.getHours() && date.setDate(date.getDate() + 1)
      date.setHours(hour)
      date.setMinutes(minutes)
      json.nextUpdataTime = +date
      if (forceLength) {
        json.forceLength = parseInt(forceLength)
      }
    }
    if (json.refresh) {
      json.refresh = json.refresh ? (parseInt(json.refresh) * 1000) : 0
      json.nextUpdataTime = +new Date() + json.refresh
    }
    if (json.forceLength) {
      json.forceLength = parseInt(json.forceLength)
    }
    if (json.filter) {
      json.filter = json.filter.split("/")
    }
    if (json.block) {
      json.block = json.block.split("/")
    }
    if (json.proxyAgent) {
      // debug("formatArg:proxyAgent");
      // debug(json.proxyAgent);

      if (json.proxyAgent == 'false' || json.proxyAgent == 'none' || json.proxyAgent == '') {
        // debug("enabled:false");
        json.proxyAgent = { enabled: false }
      } else {
        let protocol = json.proxyAgent.match(/^(http|https|socks5)(?=\/\/)/)
        let host = json.proxyAgent.match(/(?<=:\/\/)(.+?)(?=\/)/)
        let port = +json.proxyAgent.match(/(?<=\/)(\d{1,5})$/)
        let proxyAgent = { enabled: true, protocol, host, port }
        json.proxyAgent = proxyAgent
        if (json.auth) {
          let username = json.auth.split("/")[0]
          let password = json.auth.split("/")[1]
          let auth = { username, password }
          json.proxyAgent.auth = auth
        }
      }
    }
    return json
  }
  const mixinArg = (arg) => ({
    ...Object.assign({}, ...Object.values(config)),
    ...arg,
    template: arg.template || config.basic.defaultTemplate,
    proxyAgent: arg.proxyAgent ? (arg.proxyAgent.enabled ? arg.proxyAgent : { enabled: false }) : config.net.proxyAgent.enabled ? { ...config.net.proxyAgent, auth: config.net.proxyAgent.auth.enabled ? config.net.proxyAgent.auth : {} } : {}
  })
  ctx.on('ready', async () => {
    // await ctx.broadcast([`sandbox:rdbvu1xb9nn:#`], '123')
    // await sendMessageToChannel(ctx,{platform:"sandbox:rdbvu1xb9nn",guildId:"#"},"123")
    feeder()
    interval = setInterval(async () => {
      if(config.basic.imageMode=='File')await delCache()
      feeder()
    }, config.basic.refresh * 1000)
  })
  ctx.on('dispose', async () => {
    clearInterval(interval)
    if(config.basic.imageMode=='File')delCache()
  })
  ctx.guild()
    .command('rssowl <url:text>', '订阅 RSS 链接')
    .alias('rsso')
    .usage('https://github.com/borraken/koishi-plugin-rss-owl')
    .option('list', '-l 查看订阅列表')
    .option('remove', '-r <content> [订阅id|关键字] 删除订阅')
    .option('removeAll', '全部删除订阅')
    .option('arg', '-a <content> 自定义配置')
    .option('template', '-i <content> 消息模板,例:-i custom')
    .option('title', '-t <content> 自定义命名')
    .option('pull', '-p <content> [订阅id|关键字]拉取订阅id最后更新')
    .option('force', '强行写入')
    // .option('rule', '-u <ruleObject:object> 订阅规则，用于对非RSS链接的内容提取')
    .option('daily', '-d <content>')
    .option('test', '-T 测试')
    .option('quick', '-q [content] 查询快速订阅列表')
    .example('rsso https://hub.slarker.me/qqorw')
    .action(async ({ session, options }, url) => {
      // debug("init")
      // debug(options)
      // debug(session)
      const { id: guildId } = session.event.guild as any
      const { platform } = session.event as any
      const { id: author } = session.event.user as any
      debug(`${platform}:${author}:${guildId}`)
      if (options?.quick==='') {
        return '输入 rsso -q [id] 查询详情\n'+quickList.map((v,i)=>`${i+1}.${v.name}`).join('\n')
      }
      if (options?.quick) {
        let correntQuickObj = quickList[parseInt(options?.quick)-1]
        return `${correntQuickObj.name}\n${correntQuickObj.detail}\n${correntQuickObj.explain}\n例:rsso -T ${correntQuickObj.example}`
      }
      if ((platform.indexOf("sandbox") + 1) && !options.test) {
        session.send('沙盒中无法推送更新，但RSS依然会被订阅，建议使用 -T 选项进行测试')
      }
      // session.send(__filename)
      const rssList = await ctx.database.get(('rssOwl' as any), { platform, guildId })
      if (options.list) {
        // debug(`list`)
        if (!rssList.length) return '未订阅任何链接。'
        return "id:标题(最后更新)\n" + rssList.map(i => `${i.rssId}:${i.title || i.url} (${new Date(i.lastPubDate).toLocaleString()})`).join('\n')
      }
      // debug(rssList)
      if (options.pull) {
        // debug(`pull:${options.pull}`)
        let item = rssList.find(i => i.rssId === +options.pull) ||
          rssList.find(i => i.url == options.pull) ||
          rssList.find(i => i.url.indexOf(options.pull) + 1) ||
          rssList.find(i => i.title.indexOf(options.pull) + 1)
        if (item == -1) {
          return `未找到${options.pull}`
        }
        debug(`pull:${item}`)
        let { url, author, arg } = item
        arg = mixinArg(arg)
        //
        let rssItemList = await Promise.all(url.split("|")
          .map(i=>parseQuickUrl(i))
          .map(async url => await getRssData(url, arg)))
        let itemArray = rssItemList.flat(1)
          .sort((a, b) => +new Date(b.pubDate) - +new Date(a.pubDate))
        // debug("itemArray");
        // debug(itemArray);
        let rssItemArray = itemArray.filter((v, i) => arg.forceLength ? (i < arg.forceLength) : (i < 1)).filter((v, i) => arg.maxRssItem ? (i < arg.maxRssItem) : true)
        // debug("rssItemArray");
        // debug(rssItemArray);
        let messageList = (await Promise.all(rssItemArray.reverse().map(async i => await parseRssItem(i, arg, author)))).flat(Infinity)
        // debug("mergeItem");
        // debug(messageList)
        return `<message forward>${messageList.join('')}</message>`
      }
      let rssItemList
      let itemArray, item
      let optionArg = formatArg(options)
      let arg = mixinArg(optionArg)
      let urlList = url?.split('|')?.map(i=>parseQuickUrl(i))
      if (options.test) {
        debug(`test:${url}`)
        debug({ guildId, platform, author, arg, optionArg })
        if (!url) return '请输入URL'
        let rssItemList = await Promise.all(urlList
          .map(async url => await getRssData(url, arg)))
        let itemArray = rssItemList
          .flat(1)
          .sort((a, b) => +new Date(b.pubDate) - +new Date(a.pubDate))
        let rssItemArray = itemArray.filter((v, i) => arg.forceLength ? (i < arg.forceLength) : (i < 1)).filter((v, i) => arg.maxRssItem ? (i < arg.maxRssItem) : true)
        let messageList = (await Promise.all(rssItemArray.reverse().map(async i => await parseRssItem(i, arg, author)))).flat(Infinity)
        return `<message forward>${messageList.join('')}</message>`
      }
      if (options.remove) {
        // debug(`remove:${options.remove}`)
        let removeIndex = ((rssList.findIndex(i => i.rssId === +options.remove) + 1) ||
          (rssList.findIndex(i => i.url == options.remove) + 1) ||
          (rssList.findIndex(i => i.url.indexOf(options.remove) + 1) + 1) ||
          (rssList.findIndex(i => i.title.indexOf(options.remove) + 1) + 1)) - 1
        if (removeIndex == -1) {
          return `未找到${options.remove}`
        }
        let removeItem = rssList[removeIndex]
        debug(`remove:${removeItem}`)
        ctx.database.remove(('rssOwl' as any), { id: removeItem.id })
        return `已取消订阅：${removeItem.title}`
      }
      if (options?.removeAll != undefined) {
        // debug(`removeAll:${rssList.length}`)
        // debug(rssList)
        let rssLength = rssList.length
        await ctx.database.remove(('rssOwl' as any), { platform, guildId })
        return `已删除${rssLength}条`
      }
      if (config.basic.urlDeduplication && (rssList.findIndex(i => i.url == url) + 1)) {
        return '已订阅此链接。'
      }
      // debug(url)
      if (!url) {
        return '未输入url'
      }
      // debug("subscribe active")
      let getLastPubDate = () => {
        if (options.daily) {
          let time = options.daily.split("/")[0].split(":")
          let date = new Date()
          date.setHours(time[0])
          time[1] && date.setMinutes(time[1])
          return +date
        } else {
          return +new Date()
        }
      }
      const subscribe = {
        url,
        platform,
        guildId,
        author,
        rssId: (+rssList.slice(-1)?.[0]?.rssId || 0) + 1,
        arg: optionArg,
        title: options.title || (urlList.length > 1 && `订阅组:${new Date().toLocaleString()}`) || "",
        lastPubDate: getLastPubDate()
      }
      // debug(subscribe);
      if (options.force) {
        await ctx.database.create(('rssOwl' as any), subscribe)
        return '添加订阅成功'
      }
      try {
        if (!url) return '请输入URL'
        let rssItemList = await Promise.all(urlList.map(async url => await getRssData(url, arg)))
        let itemArray = rssItemList.flat(1).sort((a, b) => +new Date(b.pubDate) - +new Date(a.pubDate))
        .filter((v, i) => arg.forceLength ? (i < arg.forceLength) : (i < 1))
        .filter((v, i) => arg.maxRssItem ? (i < arg.maxRssItem) : true)
        if(urlList.length === 1)subscribe.title = subscribe.title || itemArray[0].rss.channel.title
        item = itemArray[0]
        if (!(item.pubDate || optionArg.forceLength)) {
          return "RSS中未找到可用的pubDate，这将导致无法取得更新时间，请使用forceLength属性强制在每次更新时取得最新的订阅内容"
        }

        subscribe.lastPubDate = item.pubDate || subscribe.lastPubDate
        ctx.database.create(('rssOwl' as any), subscribe)
        // rssOwl.push(JSON.stringify(subscribe)) 
        if (arg.firstLoad) {
          if (arg.forceLength) {
            let messageList = await Promise.all(itemArray.map(async () => await parseRssItem(item, arg, item.author)))
            let message = item.arg.merge ? `<message forward><author id="${item.author}"/>${messageList.join("")}</message>` : messageList.join("")
            return message
          } else {
            return `<message>添加订阅成功</message>${await parseRssItem(item, arg, author)}`
          }
        }
        return '添加订阅成功'
      } catch (error) {
        return `添加失败:${error}`
      }
    })
}