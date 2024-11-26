import { Context, Session, Logger, Schema, MessageEncoder, h, $, clone } from 'koishi'
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
  debug?: "disable"|"error"|"info"|"details"
}
const debugLevel = ["disable","error","info","details"]

interface BasicConfig {
  usePoster: boolean;
  margeVideo: boolean;
  defaultTemplate?: 'content' | 'only text' | 'only media' | 'only image' | 'proto' | 'default' | 'only description' | 'custom' | 'link'
  timeout?: number
  refresh?: number
  merge?: '不合并' | '有多条更新时合并' | '一直合并'
  maxRssItem?: number
  firstLoad?: boolean
  urlDeduplication?: boolean
  resendUpdataContent: 'disable'|'latest'|'all'
  imageMode?: 'base64' | 'File'
  videoMode?: 'filter'|'href'|'base64' | 'File'
  autoSplitImage?: boolean
  cacheDir?: string
  replaceDir?: string
  
}

interface TemplateConfig {
  customRemark: string;
  bodyWidth?: number
  bodyPadding?: number
  bodyFontSize?: number
  content?: string
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
  blockString?:string
  rssHubUrl?:string
  readCDATA?:boolean
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
  template?: 'content' | 'only text' | 'only media' | 'only image' | 'only video' | 'proto' | 'default' | 'only description' | 'custom' | 'link'
  content: string | never

  forceLength?: number
  timeout?: number
  interval?: number
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

  readCDATA?:boolean

  split?:number

  nextUpdataTime?: number
}
// export const usage = ``
const templateList = ['content', 'only text', 'only media','only image', 'only video', 'proto', 'default', 'only description', 'custom','link']

export const Config = Schema.object({
  basic: Schema.object({
    defaultTemplate: Schema.union(templateList).description('默认消息解析模板 <br> \`content\` ★ 可自定义的基础模板，适用于内容较少的订阅，无需puppeteer<br>\`only text\` 仅推送文字，无需puppeteer<br>\`only media\` 仅推送图片和视频，无需puppeteer<br>\`only image\` 仅推送图片，无需puppeteer<br>\`only video\` 仅推送视频，无需puppeteer<br>\`proto\` 推送原始内容，无需puppeteer<br>\`default\` ★ puppeteer模板，适用于大部分订阅<br>\`only description\` puppeteer模板，仅包含description内容<br>\`custom\` ★ 在default模板基础上添加了护眼的背景色及订阅信息，见下方模板设置<br>\`link\` 特殊puppeteer模板，截图内容中首个a标签网址的页面<br>在订阅时使用自定义配置时无需only字段，例:`rsso -i text <url>`使用only text模板')
      .default('content'),
    timeout: Schema.number().description('请求数据的最长时间（秒）').default(60),
    refresh: Schema.number().description('刷新订阅源的时间间隔（秒）').default(600),
    merge: Schema.union(['不合并', '有多条更新时合并', '一直合并']).description('合并消息规则').default('有多条更新时合并'),
    maxRssItem: Schema.number().description('限制更新时的最大推送数量上限，超出上限时较早的更新会被忽略').default(10),
    firstLoad: Schema.boolean().description('首次订阅时是否发送最后的更新').default(true),
    urlDeduplication: Schema.boolean().description('同群组中不允许重复添加相同订阅').default(true),
    // sendRequire: Schema.boolean().default(true).description('验证发送').experimental(),
    resendUpdataContent: Schema.union(['disable','latest','all']).description('当内容更新时再次发送').default('disable').experimental(),
    imageMode: Schema.union(['base64', 'File']).description('图片发送模式，使用File可以解决部分图片无法发送的问题，但无法在沙盒中使用').default('base64'),
    videoMode: Schema.union(['filter','href','base64', 'File']).description('视频发送模式（iframe标签内的视频无法处理）<br> \`filter\` 过滤视频，含有视频的推送将不会被发送<br> \`href\` 使用视频网络地址直接发送<br> \`base64\` 下载后以base64格式发送<br> \`File\` 下载后以文件发送').default('href'),
    margeVideo: Schema.boolean().default(false).description('以合并消息发送视频').experimental(),
    usePoster: Schema.boolean().default(false).description('加载视频封面').experimental(),
    autoSplitImage: Schema.boolean().description('自动垂直拆分大尺寸图片以避免发送限制').default(true),
    cacheDir: Schema.string().description('File模式时使用的缓存路径').default('data/cache/rssOwl'),
    replaceDir: Schema.string().description('缓存替换路径，仅在使用docker部署时需要设置').default(''),
  }).description('基础设置'),
  template: Schema.object({
    bodyWidth: Schema.number().description('puppeteer图片的宽度(px)，较低的值可能导致排版错误，仅在非custom的模板生效').default(600),
    bodyPadding: Schema.number().description('puppeteer图片的内边距(px)仅在非custom的模板生效').default(20),
    bodyFontSize: Schema.number().description('puppeteer图片的字号(px)，0为默认值，仅在非custom的模板生效').default(0),
    content: Schema.string().role('textarea', { rows: [4, 2] }).default(`《{{title}}》\n{{description}}`).description('content模板的内容，使用插值载入推送内容'),
    custom: Schema.string().role('textarea', { rows: [4, 2] }).default(`<body style="width:600px;padding:20px;background:#F5ECCD;">
      <div style="display: flex;flex-direction: column;">
          <div style="backdrop-filter: blur(5px) brightness(0.7) grayscale(0.1);display: flex;align-items: center;flex-direction: column;border-radius: 10px;border: solid;overflow:hidden">
              <div style="display: flex;align-items: center;">
                  <img src="{{rss.channel.image.url}}" style="margin-right: 10px;object-fit: scale-down;max-height: 160px;max-width: 160px;" alt="" srcset="" />
                  <p style="font-size: 20px;font-weight: bold;color: white;">{{rss.channel.title}}</p>
              </div>
              <p style="color: white;font-size: 16px;">{{rss.channel.description}}</p>
          </div>
          <div style="font-weight: bold;">{{title}}</div>
          <div>{{pubDate}}</div>
          <div>{{description}}</div>
      </div>
  </body>`).description('custom模板的内容，使用插值载入推送内容。 [说明](https://github.com/borraken/koishi-plugin-rss-owl?tab=readme-ov-file#3-%E6%8F%92%E5%80%BC%E8%AF%B4%E6%98%8E)'),
  customRemark: Schema.string().role('textarea', { rows: [3, 2] }).default(`{{description}}`).description('custom模板的文字补充，以custom图片作为description再次插值'),
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
    rssHubUrl:Schema.string().role('link').description('使用快速订阅时rssHub的地址，你可以使用`rsso -q`检查可用的快速订阅').default('https://hub.slarker.me'),
    keywordFilter: Schema.array(Schema.string()).role('table').description('关键字过滤，使用正则检查title和description中的关键字，含有关键字的推送不会发出，不区分大小写').default([]),
    keywordBlock: Schema.array(Schema.string()).role('table').description('关键字屏蔽，内容中的正则关键字会被删除，不区分大小写').default([]),
    blockString:Schema.string().description('关键字屏蔽替换内容').default('*'),
    // readCDATA: Schema.boolean().description('读取CDATA中内容，CDATA本意是需要被XML解析器忽略的内容，但部分订阅会将有效内容放入，除非必须，否则不建议开启，建议在订阅时使用`-a CDATA:true`以局部启用，开启后可能导致非预期的错误').default(false).experimental(),
    censor: Schema.boolean().description('消息审查，需要censor服务').default(false).experimental(),
  }).description('消息处理'),
  // customUrlEnable:Schema.boolean().description('开发中：允许使用自定义规则对网页进行提取，用于对非RSS链接抓取').default(false).experimental(),
  debug: Schema.union(debugLevel).default(debugLevel[0]),
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
    lastContent: "json",
    title: "string",
    lastPubDate: "timestamp",
  }, {
    autoInc: true
  }
  )
  const getDefaultTemplate = (bodyWidth, bodyPadding,bodyFontSize:number|undefined) => 
    `<body><h3>{{title}}</h3><h5>{{pubDate}}</h5><br><div>{{description}}<div></body>
    <style>*{${bodyFontSize?`font-size: ${bodyFontSize}px !important;`:''}body{width:${bodyWidth || config.template.bodyWidth}px;padding:${bodyPadding || config.template.bodyPadding}px;}}</style>`
  const getDescriptionTemplate = (bodyWidth, bodyPadding,bodyFontSize:number|undefined) => 
    `<body>{{description}}</body>
    <style>*{${bodyFontSize?`font-size: ${bodyFontSize}px !important;`:''}body{width:${bodyWidth || config.template.bodyWidth}px;padding:${bodyPadding || config.template.bodyPadding}px;}}</style>`
  let interval
  const debug = (message,name='',type:"disable"|"error"|"info"|"details"='details') =>{
    const typeLevel = debugLevel.findIndex(i=>i==type)
    if(typeLevel<1)return
    if(typeLevel > debugLevel.findIndex(i=>i==config.debug))return
    if(name)logger.info(`${type}:<<${name}>>`)
    logger.info(message)
  }
  const getImageUrl = async (url, arg,useBase64Mode=false) => {
    debug('imgUrl:'+url,'','details')
    let res
    res = await $http(url, arg, { responseType: 'arraybuffer' })
    debug(res.data,'img response','details')
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
    let src = dom.attribs.src || dom.children["0"].attribs.src
    let res
    if(config.basic.videoMode == "href"){
      return src
    }else{
      res = await $http(src, {...arg,timeout:0}, { responseType: 'arraybuffer' })
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
    debug("MB: " + MB,'file size','details');
    return `<file src="${await writeCacheFile(base64)}"/>`
  }
  const quickList = [
    {prefix:"rss",name:"rsshub通用订阅",detail:"rsshub通用快速订阅，用于快速写入及通过配置动态更换rsshub地址",explain:"rss:param1/param2/...",example:"rss:apnews/rss/business",argLength:[1,9],replace:"$1$2$3$4$5$6$7$8$9"},
    {prefix:"tg",name:"电报频道",detail:"输入电报频道信息中的链接地址最后部分，部分不提供网页预览的频道无法订阅",explain:"tg:[:channel_name]",example:"tg:woshadiao",argLength:[1,1],replace:"/telegram/channel$1"},
    {prefix:"mp-tag",name:"微信公众平台话题TAG",detail:"一些公众号（如看理想）会在微信文章里添加 Tag，浏览器打开Tag文章列表，如 https://mp.weixin.qq.com/mp/appmsgalbum?__biz=MzA3MDM3NjE5NQ==&action=getalbum&album_id=1375870284640911361，输入__biz和album_id",explain:"mp-tag:[:__biz]/[:album_id]",example:"mp-tag:MzA3MDM3NjE5NQ==/1375870284640911361",argLength:[2,2],replace:"/wechat/mp/msgalbum$1$2"},
    {prefix:"gh",name:"github相关",detail:"Repo Issue:gh:issue/[:user]/[:repo]/[:state?(open|closed|all)]/[:labels?(open|bug|...)]\nRepo Stars:gh:stars/[:user]/[:repo]\nTrending:gh:trending/[:since(daliy|weekly|monthly)]/[:language?(javascript|c#|c++|...)]/[:spoken_language?(English|Chinese|...)]\nUser Activities:gh:activity/[:user]",explain:"gh:[type]/[param1]/[param2]...",example:"gh:issue/koishijs/koishi/open",argLength:[2,5],replace:"/github$1$2$3$4$5"},
    // {prefix:"weibo",name:"微博博主",detail:"输入博主用户id",explain:"weibo:[:uid]",example:"weibo:1195230310",argLength:[1,2],replace:"/weibo/user$1$2$3$4$5"},
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
    debug(config.msg.rssHubUrl + rUrl,'quickUrl return','details')
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
    debug(cacheDir,'cacheDir','details')
    let fileList = fs.readdirSync(cacheDir)
    let suffix = /(?<=^data:.+?\/).+?(?=;base64)/.exec(fileUrl)[0]
    let fileName = `${parseInt((Math.random() * 10000000).toString()).toString()}.${suffix}`
    while (fileList.find(i => i == fileName)) {
      fileName = `${parseInt((Math.random() * 10000000).toString()).toString()}.${suffix}`
    }
    let base64Data = fileUrl.replace(/^data:.+?;base64,/, "");
    let path = `${cacheDir}/${fileName}`
    debug(path,'path','details')

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
    let requestConfig = { timeout: (arg.timeout||0) * 1000 }
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
    debug(`${url} : ${JSON.stringify({ ...requestConfig, ...config, ...proxy })}`,'request info','details')
    let res
    let retries = 3
    while (retries > 0 && !res) {
      try {
        if (retries%2) {
          res = await axios.get(url, { ...requestConfig, ...config, ...proxy })
        } else {
          res = await axios.get(url, { ...requestConfig, ...config })
        }
      } catch (error) {
        retries--
        if (retries <= 0) {
          requestRunning--
          debug({url, arg, config},'error request info','error')
          debug(error,'','error');

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
    debug(htmlContent,'htmlContent','details')
    await page.setContent(htmlContent)
    if(!config.basic.autoSplitImage)return h.image(await page.screenshot({type:"png"}),'image/png') 
    let [height,width,x,y] = await page.evaluate(()=>[document.body.offsetHeight,document.body.offsetWidth,parseInt(document.defaultView.getComputedStyle(document.body).marginLeft)||0,parseInt(document.defaultView.getComputedStyle(document.body).marginTop)||0])
    let size = 10000
    debug([height,width,x,y],'pptr img size','details')
    const split = Math.ceil(height/size)
    if(!split)return h.image(await page.screenshot({type:"png",clip:{x,y,width,height}}),'image/png')
    debug({height,width,split},'split img','details')
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
  const getRssData = async (url, config:rssArg) => {
    // let rssXML = await fetch(url)
    // let rssText = await rssXML.text()
    // let rssJson = x2js.xml2js(rssText)
    // console.log(rssXML);
    let res = (await $http(url, config)).data
    if(config.readCDATA){
      res = res.replace(/<!\[CDATA\[(.+?)\]\]>/g,i=>i.match(/^<!\[CDATA\[(.*)\]\]>$/)[1])
    }
    let rssJson = x2js.xml2js(res)
    debug(rssJson,'rssJson','details');
    if(rssJson.rss){
      //rss
      rssJson.rss.channel.item = [rssJson.rss.channel.item].flat(Infinity)
      const rssItemList = rssJson.rss.channel.item.map(i => ({ ...i, rss: rssJson.rss }))
      return rssItemList
    }else if(rssJson.feed){
      //atom
      let rss = {channel:{}}
      let parseContent = (content)=>{
        if(typeof content =='string')return content
        if(content['__cdata'])return content['__cdata']?.join?.("")||content['__cdata']
        if(content['__text'])return content['__text']?.join?.("")||content['__text']
        // debug(content,'未知ATOM订阅的content格式，请联系插件作者更新','info')
        return Object.values(content).reduce((t:string,v:any)=>{
          if(v&&(typeof v =='string'||v?.join)){
            let text:string = v?.join("")||v
            return text.length > t.length ? text : t
          }else{return t}
        },'')
      }
      let item = rssJson.feed.entry.map(i=>({
        ...i,
        title:i.title,
        description:parseContent(i.content),
        link:i.link?.['_href']||i.link?.[0]?.['_href'],
        guid:i.id,
        pubDate:i.updated,
        author:i.author[0]?.name||i.author?.name,
        // category:i,
        // comments:i,
        // enclosure:i,
        // source:i,
      }))
      rss.channel = {
        title:rssJson.feed.title,
        link:rssJson.feed.link?.[0]?.href||rssJson.feed.link?.href,
        description:rssJson.feed.summary,
        generator:rssJson.feed.generator,
        // webMaster:undefined,
        language:rssJson.feed['@xml:lang'],
        item
      }
      item = item.map(i=>({rss,...i}))
      debug(item,'atom item','details')
      return item
    }else{
      debug(rssJson,'未知rss格式，请提交issue','error')
    }
  }
  const parseRssItem = async (item: any, arg: rssArg, authorId: string | number) => {
    debug(arg,'rss arg','details');
    // let messageItem = Object.assign({}, ...arg.rssItem.map(key => ({ [key]: item[key.split(":")[0]] ?? "" })))
    let template = arg.template
    let msg: string = ""
    let html
    let videoList = []
    item.description = item.description?.join?.('') || item.description
    //block
    arg.block?.forEach(blockWord =>{
      item.description = item.description.replace(new RegExp(blockWord, 'gim'), i => Array(i.length).fill(config.msg.blockString).join(""))
      item.title = item.title.replace(new RegExp(blockWord, 'gim'), i => Array(i.length).fill(config.msg.blockString).join(""))
    })
    // const pushVideo = (msg, html) => `${msg}${config.basic.videoFetch ? html('video').map((v, i) => i.attribs.src).map(i => `<video src="${i}"/>`).join() : ''}`
    debug(template,'template');
    // const toString = (obj)=>typeof obj === 'object' ? JSON.stringify(obj) : obj
    const parseContent = (template,item)=>template.replace(/{{(.+?)}}/g, i =>i.match(/^{{(.*)}}$/)[1].split("|").reduce((t,v)=>t||v.match(/^'(.*)'$/)?.[1]||v.split(".").reduce((t, v) => new RegExp("Date").test(v) ? new Date(t?.[v]).toLocaleString('zh-CN') : t?.[v] || "", item),''))
    if(config.basic.videoMode==='filter'){
      html = cheerio.load(item.description)
      html('video').length > 0
      return ''
    }
    if (template == "custom") {
      // description = config.template.custom.replace(/{{(.+?)}}/g, i =>i.match(/^{{(.*)}}$/)[1].split(".").reduce((t, v) => new RegExp("Date").test(v) ? new Date(t?.[v]).toLocaleString('zh-CN') : t?.[v] || "", item))
      item.description = parseContent(config.template.custom,{...item,arg})
      debug(item.description,'description');
      html = cheerio.load(item.description)
      if(arg?.proxyAgent?.enabled){
        await Promise.all(html('img').map(async(v,i)=>i.attribs.src = await getImageUrl(i.attribs.src,arg,true) )) 
      }
      html('img').attr('style', 'object-fit:scale-down;max-width:100%;')
      if(config.basic.imageMode=='base64'){
        msg = (await renderHtml2Image(html.html())).toString()
      }else if(config.basic.imageMode=='File'){
        msg = await ctx.puppeteer.render(html.html())
        msg = await puppeteerToFile(msg)
      }
      msg = parseContent(config.template.customRemark,{...item,arg,description:msg})

      await Promise.all(html('video').map(async(v,i)=>videoList.push([await getVideoUrl(i.attribs.src,arg,true,i),(i.attribs.poster&&config.basic.usePoster)?await getImageUrl(i.attribs.poster,arg,true):""])))
      msg += videoList.map(([src,poster])=>h('video',{src,poster})).join("")
      
    } else if (template == "content") {
      html = cheerio.load(item.description)
      let imgList = []
      html('img').map((key, i) => imgList.push(i.attribs.src))
      imgList = [...new Set(imgList)]
      let imgBufferList = Object.assign({}, ...(await Promise.all(imgList.map(async src => ({ [src]: await getImageUrl(src, arg) })))))
      // imgList = await Promise.all(imgList.map(async ([key,i])=>({[key]:await getImageUrl(i, arg)}))) 
      html('img').replaceWith((key, Dom) => `<p>$img{{${imgList[key]}}}</p>`)
      msg = html.text()
      item.description = msg.replace(/\$img\{\{(.*?)\}\}/g, match => {
        let src = match.match(/\$img\{\{(.*?)\}\}/)[1]
        return `<img src="${imgBufferList[src]}"/>`
      })
      msg = parseContent(config.template.content,{...item,arg})
      logger.info(msg)
      // msg = `${item?.title?`《${item?.title}》\n`:''}${msg}`
      // await Promise.all(html('video').map(async(v,i)=>videoList.push(await getVideoUrl(i.attribs.src,arg,true,i))))
      // msg += videoList.map(src=>h.video(src)).join("")
      
      await Promise.all(html('video').map(async(v,i)=>videoList.push([await getVideoUrl(i.attribs.src,arg,true,i),(i.attribs.poster&&config.basic.usePoster)?await getImageUrl(i.attribs.poster,arg,true):""])))
      msg += videoList.map(([src,poster])=>h('video',{src,poster})).join("")
      msg+=videoList.map(([src,poster])=>h('img',{src:poster})).join("")
    } else if (template == "only text") {
      html = cheerio.load(item.description)
      msg = html.text()
    } else if (template == "only media") {
      html = cheerio.load(item.description)
      
      let imgList = []
      html('img').map((key, i) => imgList.push(i.attribs.src))
      imgList = await Promise.all([...new Set(imgList)].map(async src =>await getImageUrl(src, arg)))
      msg = imgList.map(img => `<img src="${img}"/>`).join("")

      await Promise.all(html('video').map(async(v,i)=>videoList.push([await getVideoUrl(i.attribs.src,arg,true,i),(i.attribs.poster&&config.basic.usePoster)?await getImageUrl(i.attribs.poster,arg,true):""])))
      msg += videoList.map(([src,poster])=>h('video',{src,poster})).join("")
    } else if (template == "only image") {
      html = cheerio.load(item.description)
      let imgList = []
      html('img').map((key, i) => imgList.push(i.attribs.src))
      imgList = await Promise.all([...new Set(imgList)].map(async src =>await getImageUrl(src, arg)))
      msg = imgList.map(img => `<img src="${img}"/>`).join("")
    } else if (template == "only video") {
      html = cheerio.load(item.description)
      // await Promise.all(html('video').map(async(v,i)=>videoList.push(await getVideoUrl(i.attribs.src,arg,true,i))))
      // msg += videoList.map(src=>h.video(src,{poster:``})).join("")
      await Promise.all(html('video').map(async(v,i)=>videoList.push([await getVideoUrl(i.attribs.src,arg,true,i),(i.attribs.poster&&config.basic.usePoster)?await getImageUrl(i.attribs.poster,arg,true):""])))
      msg += videoList.map(([src,poster])=>h('video',{src,poster})).join("")
    } else if (template == "proto") {
      msg = item.description
    } else if (template == "default") {
      item.description = parseContent(getDefaultTemplate(config.template.bodyWidth, config.template.bodyPadding,config.template.bodyFontSize),{...item,arg})
      debug(item.description,'description');
      html = cheerio.load(item.description)
      if(arg?.proxyAgent?.enabled){
        await Promise.all(html('img').map(async(v,i)=>i.attribs.src = await getImageUrl(i.attribs.src,arg,true) )) 
      }
      html('img').attr('style', 'object-fit:scale-down;max-width:100%;')
      if(config.basic.imageMode=='base64'){
        msg = (await renderHtml2Image(html.html())).toString()
      }else if(config.basic.imageMode=='File'){
        msg = await ctx.puppeteer.render(html.html())
        msg = await puppeteerToFile(msg)
      }
      if(config.basic.imageMode=='File')msg = await puppeteerToFile(msg)
      // await Promise.all(html('video').map(async(v,i)=>videoList.push(await getVideoUrl(i.attribs.src,arg,true,i))))
      // msg += videoList.map(src=>h.video(src)).join("")
      await Promise.all(html('video').map(async(v,i)=>videoList.push([await getVideoUrl(i.attribs.src,arg,true,i),(i.attribs.poster&&config.basic.usePoster)?await getImageUrl(i.attribs.poster,arg,true):""])))
      msg += videoList.map(([src,poster])=>h('video',{src,poster})).join("")
    } else if (template == "only description") {
      item.description =parseContent(getDescriptionTemplate(config.template.bodyWidth, config.template.bodyPadding,config.template.bodyFontSize),{...item,arg})
      html = cheerio.load(item.description)
      if(arg?.proxyAgent?.enabled){
        await Promise.all(html('img').map(async(v,i)=>i.attribs.src = await getImageUrl(i.attribs.src,arg,true) )) 
      }
      html('img').attr('style', 'object-fit:scale-down;max-width:100%;')
      if(config.basic.imageMode=='base64'){
        msg = (await renderHtml2Image(html.html())).toString()
      }else if(config.basic.imageMode=='File'){
        msg = await ctx.puppeteer.render(html.html())
        msg = await puppeteerToFile(msg)
      }
      // await Promise.all(html('video').map(async(v,i)=>videoList.push(await getVideoUrl(i.attribs.src,arg,true,i))))
      // msg += videoList.map(src=>h.video(src)).join("")
      await Promise.all(html('video').map(async(v,i)=>videoList.push([await getVideoUrl(i.attribs.src,arg,true,i),(i.attribs.poster&&config.basic.usePoster)?await getImageUrl(i.attribs.poster,arg,true):""])))
      msg += videoList.map(([src,poster])=>h('video',{src,poster})).join("")
    } else if (template == "link") {
      html = cheerio.load(item.description)
      let src = html('a')[0].attribs.href
      debug(src,'link src','info')
      let html2 = cheerio.load((await $http(src,arg)).data)
      if(arg?.proxyAgent?.enabled){
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
    if (config.msg.censor) {
      msg = `<censor>${msg}</censor>`
    }
    debug(msg,"parse:msg",'info');
    return msg
  }
  const feeder = async () => {
    debug("feeder");
    const rssList = await ctx.database.get(('rssOwl' as any), {})
    debug(rssList,'rssList','info');
    for (const rssItem of rssList) {
      // console.log(`${rssItem.platform}:${rssItem.guildId}`);
      try {
        let arg: rssArg = mixinArg(rssItem.arg || {})
        debug(arg,'arg','details')
        debug(rssItem.arg,'originalArg','details')
        let originalArg
        if (rssItem.arg.interval) {
          if (arg.nextUpdataTime > +new Date()) continue
          // arg.nextUpdataTime = arg.nextUpdataTime + arg.refresh
          originalArg.nextUpdataTime = arg.nextUpdataTime + arg.interval*Math.ceil((+new Date() - arg.nextUpdataTime)/arg.interval)
        }
        try {
          let rssItemList = (await Promise.all(rssItem.url.split("|")
            .map(i=>parseQuickUrl(i))
            .map(async url => await getRssData(url, arg)))).flat(1)
          let itemArray = rssItemList.sort((a, b) => +new Date(b.pubDate) - +new Date(a.pubDate))
            .filter(item => !arg.filter?.some(keyword => {
              let isFilter = new RegExp(keyword, 'im').test(item.title) || new RegExp(keyword, 'im').test(item.description)
              if(isFilter){
                debug(`filter:${keyword}`,'','info')
                debug(item,'filter rss item','info')
                return true
              }else{return false}
            }))
          
          const getLastContent = (item)=>{
            let arr = ['title','description','link','guid']
            return Object.assign({},...arr.map(i=>clone(item?.[i]?{[i]:item[i]}:{})))
          }
          let lastContent = {itemArray:config.basic.resendUpdataContent==='all'?itemArray.map(getLastContent):config.basic.resendUpdataContent==='latest'? [getLastContent(itemArray[0])] :[]}
          
          let lastPubDate = +new Date(itemArray[0].pubDate) || 0
          if (arg.reverse) {
            itemArray = itemArray.reverse()
          }
          debug(itemArray[0],'first rss response','details');
          let messageList, rssItemArray
          if (rssItem.arg.forceLength) {
            // debug("forceLength");
            debug(`forceLength:${rssItem.arg.forceLength}`,'','details');
            rssItemArray = itemArray.filter((v, i) => i < arg.forceLength)
            debug(rssItemArray.map(i => i.title),'','info');
            messageList = await Promise.all(itemArray.filter((v, i) => i < arg.forceLength).map(async i => await parseRssItem(i, {...rssItem,...arg}, rssItem.author)))
          } else {
            rssItemArray = itemArray.filter((v, i) => (+new Date(v.pubDate) > rssItem.lastPubDate)||rssItem.lastContent?.itemArray?.some(oldRssItem=>{
              if(!(oldRssItem?.guid?(oldRssItem.guid===v.guid):(oldRssItem.link===v.link&&oldRssItem.title===v.title)))return false
              return oldRssItem.description!==v.description
            })).filter((v, i) => !arg.maxRssItem || i < arg.maxRssItem)
            if (!rssItemArray.length) continue
            debug(`${JSON.stringify(rssItem)}:共${rssItemArray.length}条新信息`,'','info');
            debug(rssItemArray.map(i => i.title),'','info');
            messageList = await Promise.all(rssItemArray.reverse().map(async i => await parseRssItem(i, {...rssItem,...arg}, rssItem.author)))
          }
          let message
          if(!messageList.join(""))return
          if (arg.merge===true) {
            message = `<message forward><author id="${rssItem.author}"/>${messageList.join("")}</message>`
          } else if (arg.merge === false) {
            message = messageList.join("")
          } else if (config.basic.margeVideo&&messageList.some(msg=>(/<video.*>/).test(msg))) {
            message = `<message forward><author id="${rssItem.author}"/>${messageList.map(i=>`<message>${i}</message>`).join("")}</message>`
          } else if (config.basic.merge == "一直合并") {
            message = `<message forward><author id="${rssItem.author}"/>${messageList.map(i=>`<message>${i}</message>`).join("")}</message>`
          } else if (config.basic.merge == "不合并") {
            message = messageList.join("")
          } else if (config.basic.merge == "有多条更新时合并") {
            message = messageList.length > 1 ? `<message forward><author id="${rssItem.author}"/>${messageList.map(i=>`<message>${i}</message>`).join("")}</message>` : messageList.join("")
          }
          debug(`更新内容采集完成:${rssItem.title}`,'','info')
          debug(await ctx.broadcast([`${rssItem.platform}:${rssItem.guildId}`], message),'broadcast return','info')
          
          debug(lastPubDate,'lastPubDate','info')
          await ctx.database.set(('rssOwl' as any), { id: rssItem.id }, { lastPubDate,arg:originalArg,lastContent })
          debug(`更新成功:${rssItem.title}`,'','info')
        } catch (error) {
          debug(error,`更新失败:${JSON.stringify(rssItem)}`,'error')
        }
        
      } catch (error) {
        debug(error,'','error')
      }
    }
  }
  const formatArg = (options): rssArg => {
    let { arg, template, daily } = options
    let json = Object.assign({}, ...(arg?.split(',')?.map(i => ({ [i.split(":")[0]]: i.split(":")[1] })) || []))
    let key = ["forceLength", "reverse", "timeout", "interval", "merge", "maxRssItem", "firstLoad", "bodyWidth", "bodyPadding", "proxyAgent", "auth"]
    let booleanKey = ['firstLoad',"reverse", 'merge']
    let numberKey = ['forceLength', "timeout",'interval','maxRssItem','bodyWidth','bodyPadding']
    let falseContent = ['false', 'null', '']

    json = Object.assign({}, ...Object.keys(json).filter(i => key.some(key => key == i)).map(key => ({ [key]: booleanKey.some(bkey => bkey == key) ? falseContent.some(c => c == json[key]) : numberKey.some(nkey => nkey == key)?(+json[key]):json[key] })))


    // if (rssItem) {
    //   json['rssItem'] = rssItem.split(',')
    // }
    if (template && templateList.find(i => new RegExp(template).test(i))) {
      json['template'] = templateList.find(i => new RegExp(template).test(i))
    }
    if (daily) {
      json['interval'] = 1440
      let [hour = 8, minutes = 0] = daily.split("/")[0].split(":").map(i => parseInt(i))
      minutes = minutes > 60 ? 0 : minutes < 0 ? 0 : minutes
      let date = new Date()
      date.setHours(hour,minutes,0,0)
      if(+new Date()>+date){date.setDate(date.getDate()+1)}
      json.nextUpdataTime = +date
      
      let forceLength = parseInt(options.daily.split("/")?.[1])
      if (forceLength) {
        json.forceLength = forceLength
      }
    }
    if (json.interval) {
      json.interval = json.interval ? (parseInt(json.interval) * 1000) : 0
      // json.nextUpdataTime = +new Date() + json.interval
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
      if (json.proxyAgent == 'false' || json.proxyAgent == 'none' || json.proxyAgent === '') {
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
    debug(json,'formatArg','details')
    return json
  }
  const mixinArg = (arg):rssArg => ({
    ...Object.assign({}, ...Object.entries(config).map(([key,value])=>typeof value === 'object'?value:{[key]:value})),
    ...arg,
    filter:[...config.msg.keywordFilter,...(arg?.filter||[])],
    block:[...config.msg.keywordBlock,...(arg?.block||[])],
    // readCDATA: arg.CDATA??config.msg.readCDATA,
    template: arg.template ?? config.basic.defaultTemplate,
    proxyAgent: arg?.proxyAgent ? (arg.proxyAgent?.enabled ? arg.proxyAgent : { enabled: false }) : config.net.proxyAgent.enabled ? { ...config.net.proxyAgent, auth: config.net.proxyAgent.auth.enabled ? config.net.proxyAgent.auth : {} } : {}
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
    .option('list', '-l [content] 查看订阅列表(详情)')
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
      debug(options,'options','info')
      
      const { id: guildId } = session.event.guild as any
      const { platform } = session.event as any
      const { id: author } = session.event.user as any
      debug(`${platform}:${author}:${guildId}`,'','info')
      if (options?.quick==='') {
        return '输入 rsso -q [id] 查询详情\n'+quickList.map((v,i)=>`${i+1}.${v.name}`).join('\n')
      }
      if (options?.quick) {
        let correntQuickObj = quickList[parseInt(options?.quick)-1]
        return `${correntQuickObj.name}\n${correntQuickObj.detail}\n${correntQuickObj.explain}\n例:rsso -T ${correntQuickObj.example}`
      }
      if ((platform.indexOf("sandbox") + 1) && !options.test && url) {
        session.send('沙盒中无法推送更新，但RSS依然会被订阅，建议使用 -T 选项进行测试')
      }
      // session.send(__filename)
      const rssList = await ctx.database.get(('rssOwl' as any), { platform, guildId })
      
      if (options?.list==='') {
        debug(rssList,'rssList','info')
        if (!rssList.length) return '未订阅任何链接。'
        return "使用'rsso -l [id]'以查询详情 \nid:标题(最后更新)\n" + rssList.map(i => `${i.rssId}:${i.title || i.url} (${new Date(i.lastPubDate).toLocaleString('zh-CN')})`).join('\n')
      }
      if (options?.list) {
        let rssObj = rssList.find(i=>i.rssId===parseInt(options?.list))||rssList.find(i=>new RegExp(options?.list).test(i.title))
        if(!rssObj)return '未找到订阅。请输入"rsso -l"查询列表或"rsso -l [订阅id]"查询订阅详情'
        const showArgNameList = ['rssId','title','url','template','platform','guildId','author','merge','timeout','interval','forceLength','nextUpdataTime','maxRssItem','lastPubDate']
        const _rssArg = Object.assign(rssObj.arg,rssObj)
        return showArgNameList.map(argName=>{
          if(!_rssArg?.[argName])return ''
          let text = ''
          if(argName==='url'){
            text = _rssArg?.[argName].split("|").map(i=>` ${parseQuickUrl(i)} ${i==parseQuickUrl(i)?'':`(${i})`}`).join(" | ")
          }else if(argName.includes('Date')||argName.includes('Time')){
            text = new Date(_rssArg?.[argName]).toLocaleString('zh-CN')
          }else{
            text = typeof _rssArg?.[argName] ==='object'? JSON.stringify(_rssArg?.[argName]):_rssArg?.[argName]
          }
          return `${argName}:${text}`
        }).filter(Boolean).join('\n')
         
      }
      if (options.remove) {
        debug(`remove:${options.remove}`,'','info')
        let removeIndex = ((rssList.findIndex(i => i.rssId === +options.remove) + 1) ||
          (rssList.findIndex(i => i.url == options.remove) + 1) ||
          (rssList.findIndex(i => i.url.indexOf(options.remove) + 1) + 1) ||
          (rssList.findIndex(i => i.title.indexOf(options.remove) + 1) + 1)) - 1
        if (removeIndex == -1) {
          return `未找到${options.remove}`
        }
        let removeItem = rssList[removeIndex]
        debug(`remove:${removeItem}`,'','info')
        ctx.database.remove(('rssOwl' as any), { id: removeItem.id })
        return `已取消订阅：${removeItem.title}`
      }
      if (options?.removeAll != undefined) {
        // debug(`removeAll:${rssList.length}`)
        debug(rssList,'','info')
        let rssLength = rssList.length
        await ctx.database.remove(('rssOwl' as any), { platform, guildId })
        return `已删除${rssLength}条`
      }

      if (options.pull) {
        let item = rssList.find(i => i.rssId === +options.pull) ||
          rssList.find(i => i.url == options.pull) ||
          rssList.find(i => i.url.indexOf(options.pull) + 1) ||
          rssList.find(i => i.title.indexOf(options.pull) + 1)
        if (item == -1) {
          return `未找到${options.pull}`
        }
        debug(`pull:${item.title}`,'','info')
        let { url, author, arg } = item
        arg = mixinArg(arg)
        //
        let rssItemList = await Promise.all(url.split("|")
          .map(i=>parseQuickUrl(i))
          .map(async url => await getRssData(url, arg)))
        let itemArray = rssItemList.flat(1)
          .sort((a, b) => +new Date(b.pubDate) - +new Date(a.pubDate))
        debug(itemArray,'itemArray','info');
        let rssItemArray = itemArray.filter((v, i) => arg.forceLength ? (i < arg.forceLength) : (i < 1)).filter((v, i) => arg.maxRssItem ? (i < arg.maxRssItem) : true)
        debug(rssItemArray,"rssItemArray",'info');
        let messageList = (await Promise.all(rssItemArray.reverse().map(async i => await parseRssItem(i, {...item,...arg}, author)))).flat(Infinity)
        // debug("mergeItem");
        debug(messageList,"mergeItem",'info')
        return `<message forward>${messageList.join('')}</message>`
      }
      let item
      let optionArg = formatArg(options)
      let arg = mixinArg(optionArg)
      let urlList = url?.split('|')?.map(i=>parseQuickUrl(i))
      const subscribe = {
        url,
        platform,
        guildId,
        author,
        rssId: (+rssList.slice(-1)?.[0]?.rssId || 0) + 1,
        arg: optionArg,
        lastContent:{itemArray:[]},
        title: options.title || (urlList.length > 1 && `订阅组:${new Date().toLocaleString('zh-CN')}`) || "",
        lastPubDate: 0
      }
      
      if (options.test) {
        debug(`test:${url}`,'','info')
        debug({ guildId, platform, author, arg, optionArg },'','info')
        if (!url) return '请输入URL'
        let rssItemList = await Promise.all(urlList
          .map(async url => await getRssData(url, arg)))
        let itemArray = rssItemList
          .flat(1)
          .sort((a, b) => +new Date(b.pubDate) - +new Date(a.pubDate))
        let rssItemArray = itemArray.filter((v, i) => arg.forceLength ? (i < arg.forceLength) : (i < 1)).filter((v, i) => arg.maxRssItem ? (i < arg.maxRssItem) : true)
        let messageList = (await Promise.all(rssItemArray.reverse().map(async i => await parseRssItem(i, {...subscribe,...arg}, author)))).flat(Infinity)
        return `<message forward>${messageList.join('')}</message>`
      }
      if (config.basic.urlDeduplication && (rssList.findIndex(i => i.url == url) + 1)) {
        return '已订阅此链接。'
      }
      debug(url,'','info')
      if (!url) {
        return '未输入url'
      }
      debug(subscribe,"subscribe",'info');
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

        subscribe.rssId =  (+(await ctx.database.get(('rssOwl' as any), { platform, guildId })).slice(-1)?.[0]?.rssId || 0) + 1
        subscribe.lastPubDate = item.pubDate || subscribe.lastPubDate
        ctx.database.create(('rssOwl' as any), subscribe)
        // rssOwl.push(JSON.stringify(subscribe)) 
        if (arg.firstLoad) {
          if (arg.forceLength) {
            let messageList = await Promise.all(itemArray.map(async () => await parseRssItem(item, {...subscribe,...arg}, item.author)))
            let message = item.arg.merge ? `<message forward><author id="${item.author}"/>${messageList.join("")}</message>` : messageList.join("")
            return message
          } else {
            return `<message>添加订阅成功</message>${await parseRssItem(item, {...subscribe,...arg}, author)}`
          }
        }
        return '添加订阅成功'
      } catch (error) {
        debug(error,'添加失败','error')
        return `添加失败:${error}`
      }
    })
}