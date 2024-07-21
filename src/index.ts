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
export const inject = {required:["database"] ,optional: ["puppeteer","censor"]}

declare module 'koishi' {
  interface rssOwl {
    id:string|number
    url : string
    platform : string
    guildId : string
    author:string
    rssId:number
    arg:rssArg,
    title:string
    lastPubDate:number
  }
}

export interface Config {
  timeout?: number
  refresh?: number
  firstLoad?: boolean
  merge?: boolean
  mergeItem?: boolean
  maxRssItem?:number
  urlDeduplication?: boolean
  userAgent?: string
  proxyAgent?: proxyAgent
  toHTML?: boolean
  domFrame?: string
  onlySelf?: any
  censor?: boolean
  videoRepost?: boolean
  videoFetch?: boolean
  keywordFilter?: Array<string>
  rssItem?: object
  custom?: string
  customUrlEnable?: boolean
  quickUrl?: Object
  imageMode?: string
  debug?: boolean
}
export interface proxyAgent {
  enabled ?: boolean
  protocol?:string
  host?:string,
  port?:number
  auth?:auth
}
export interface auth {
  enabled : boolean
  username:string
  password:string
}
export interface rss {
  url : string
  id:string|number
  arg:rssArg,
  title:string
  author:string
  lastPubDate:number
}
export interface rssArg {
  content: string|never
  forceRead?:number
  
  timeout?: number
  firstLoad?: boolean
  merge?: boolean
  mergeItem?: boolean
  maxRssItem?:number
  userAgent?: string
  proxyAgent?: proxyAgent
  toHTML?: boolean
  videoRepost?: boolean
  videoFetch?: boolean
  keywordFilter?: Array<string>
  rssItem?: Array<string>
  custom?: string
  customUrlEnable?: boolean
}
// export const usage = ``
export const Config: Schema<Config> = Schema.object({
  timeout: Schema.number().description('请求数据的最长时间（秒）').default(60),
  refresh: Schema.number().description('刷新订阅源的时间间隔（秒）').default(600),
  firstLoad:Schema.boolean().description('首次订阅时是否发送最后的更新').default(true),
  merge:Schema.boolean().description('更新以合并消息发送，建议在rssItem多于1时开启').default(false),
  mergeItem:Schema.boolean().description('单RSS订阅有多条更新时以合并消息发送，不同订阅链接间不会合并').default(true),
  maxRssItem: Schema.number().description('限制单RSS订阅更新时的最大推送数量上限，超出上限时较早的更新会被忽略，防止意外情况导致刷屏(0表示不限制)').default(10),
  urlDeduplication:Schema.boolean().description('同群组中不允许添加多条相同订阅').default(true),
  toHTML: Schema.boolean().description("渲染成网页发送，需要puppeteer服务。在不启用的情况下将分开发送文字图片，建议开启以获得更稳定的体验").default(false),
  domFrame: Schema.string().role('textarea').default('<body style="width:400px;padding:20px">{{description}}</body>').description("使用puppeteer时添加外层dom以获取更好的手机阅读体验，仅支持 `{{description}}` 插值，custom中不会生效，请注意区分"),
  onlySelf: Schema.intersect([
    Schema.object({enabled: Schema.boolean().default(false).description('仅允许指定用户操作').experimental(),}),
    Schema.union([Schema.object({
      enabled: Schema.const(true).required(),
      rssHubUrl:Schema.dict(Boolean).description('按照 平台:用户id 写入，用户id与rssOwl数据库中的author相同').default({"onebot:10000":false}),
    }),Schema.object({}),]),
  ]).experimental(),
  censor: Schema.boolean().description('消息审查，需要censor服务').default(false).experimental(),
  videoRepost: Schema.boolean().description('允许发送视频，关闭时建议在关键字过滤中添加 `<video.+>` 以忽略相关推送').default(false),
  videoFetch: Schema.boolean().description('开发中：视频本地转发').default(false).experimental(),
  keywordFilter: Schema.array(Schema.string()).description('关键字过滤，item中title和description中含有关键字时不会推送，不区分大小写').default(['nsfw']).experimental(),
  rssItem: Schema.dict(Boolean).description('提取item中的key和channel中的key，按顺序推送 [RSS源`<item>`中的元素](https://www.rssboard.org/rss-specification#hrelementsOfLtitemgt) 。关闭key右边的开关会使 rss-owl 忽略这个key').default({"channel.title":false,"title":false,"author":false,"pubDate":false,"link":false,"description":true,"custom":false}),
  custom:Schema.string().role('textarea').default(`<body style="width:400px;padding:20px;background:#F5ECCD;">
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
</body>`).description('rssItem中custom的内容，根据当前配置使用puppeteer，使用插值调用rssItem中所有内容，订阅时使用`&nbsp;`代替空格'),
  customUrlEnable:Schema.boolean().description('开发中：允许使用自定义规则对网页进行提取，用于对非RSS链接抓取').default(false).experimental(),
  quickUrl:Schema.intersect([
    Schema.object({enabled: Schema.boolean().default(false).description('开发中：允许使用快速订阅').experimental(),}),
    Schema.union([Schema.object({
      enabled: Schema.const(true).required(),
      rssHubUrl:Schema.string().role('link').description('rssHub的地址').default('https://rsshub.rssforever.com').experimental(),
      biliVideoSubmission:Schema.boolean().description('通过 bili://<用户id> 订阅b站用户视频更新，内置arg规则，例：rsso bili://2267573').default(true).experimental(),
    }),Schema.object({}),]),
  ]).experimental(),
  userAgent: Schema.string(),
  // proxyAgent: Schema.string().role('link').description('请求的代理地址').experimental(),
  proxyAgent:Schema.intersect([
    Schema.object({enabled: Schema.boolean().default(false).description('使用代理'),}),
    Schema.union([Schema.object({
      enabled: Schema.const(true).required(),
      protocol:Schema.union(['http', 'https', 'socks5']).default('http'),
      host:Schema.string().role('link').default('127.0.0.1'),
      port:Schema.number().default(7890),
      auth:Schema.intersect([
        Schema.object({enabled: Schema.boolean().default(false),}),
        Schema.union([Schema.object({
          enabled: Schema.const(true).required(),
          username:Schema.string(),
          password:Schema.string(),
        }),Schema.object({}),]),
      ])
    }),Schema.object({}),]),
  ]),
  imageMode:Schema.union(['base64', 'localFile']).default('base64'),
  debug:Schema.boolean().description('调试开关').default(false),
})
export function apply(ctx: Context, config: Config) {
  ctx.model.extend(('rssOwl' as any ),{
    id:{
      type:"integer",
      length:65535
    },
    url:"text",
    platform:"string",
    guildId:"string",
    author:"string",
    rssId:{
      type:"integer",
      length:65535
    },
    arg:"json",
    title:"string",
    lastPubDate:"timestamp",
  },{
    autoInc:true
  }
 )
  let interval
  const debug = (message)=>config.debug&&logger.info(message)
  const feeder = async ()=>{
    debug("feeder");
    const rssList = await ctx.database.get(('rssOwl' as any ),{})
    debug(rssList);
    for (const rssItem of rssList) {
      // console.log(`${rssItem.platform}:${rssItem.guildId}`);
      let arg = mixinArg(rssItem.arg||{})
      if(rssItem.arg.refresh){
        if(arg.nextUpdataTime>+new Date())continue
        let nextUpdataTime = arg.nextUpdataTime+arg.refresh
        await ctx.database.set(('rssOwl' as any ),{id:rssItem.id},{nextUpdataTime})
      }
      try {
        let rssJsonArray = (await Promise.all(rssItem.url.split("|")
        .map(async url => await getRssData(url,arg))))
        let itemArray = rssJsonArray.map(i=>i.rss.channel.item).flat(1)
          .sort((a,b)=>+new Date(b.pubDate)-+new Date(a.pubDate))
          .filter(item=>!arg.keywordFilter.find(keyword=>new RegExp(keyword,'im').test(item.title)||new RegExp(keyword,'im').test(item.description)))
          
        if(arg.reverse){
          itemArray = itemArray.reverse()
        }
        debug(rssItem.lastPubDate);
        debug("itemArray");
        debug(itemArray[0]);
        let rssItemArray = itemArray.filter((v,i)=>arg.forceLength?(i<arg.forceLength):(+new Date(v.pubDate)>rssItem.lastPubDate)).filter((v,i)=>!arg.maxRssItem||i<arg.maxRssItem)
        debug(`${JSON.stringify(rssItem)}:共${rssItemArray.length}条新信息`);
        debug(rssItemArray.map(i=>i.title));
        if(rssItem.arg.forceLength){
          debug("forceLength");
          let messageList = await Promise.all(itemArray.filter((v,i)=>i<arg.forceLength).map(async i=>await parseRssItem(i,{...arg,merge:false},rssItem.author,Object.assign({},...rssJsonArray))))
          let message = arg.merge?`<message forward><author id="${rssItem.author}"/>${messageList.join("")}</message>`:messageList.join("")
          // ctx.broadcast([`${item.platform}:${item.guildId}`],message)
          sendMessageToChannel(ctx,{platform:rssItem.platform,guildId:rssItem.guildId},message)
          await ctx.database.set(('rssOwl' as any ),{id:rssItem.id},{lastPubDate:+new Date(itemArray?.[0]?.pubDate||0)})
        }
        if(!rssItemArray.length)continue
        if(arg.mergeItem&&rssItemArray.length>1){
          debug("mergeItem");
          let messageList = await Promise.all(rssItemArray.reverse().map(async i=>await parseRssItem(i,{...arg,merge:false},rssItem.author,Object.assign({},...rssJsonArray))))
          // debug(messageList.map(i=>i.slice(0,100)))
          sendMessageToChannel(ctx,{platform:rssItem.platform,guildId:rssItem.guildId},`<message forward><author id="${rssItem.author}"/>${messageList.join('')}</message>`)
          await ctx.database.set(('rssOwl' as any ),{id:rssItem.id},{lastPubDate:+new Date(rssItemArray[0].pubDate)})
        }else{
          debug("default");
          rssItemArray.reverse().forEach(async i => {
            // ctx.broadcast([`${item.platform}:${item.guildId}`], await parseRssItem(item,arg,item.author))
            sendMessageToChannel(ctx,{platform:rssItem.platform,guildId:rssItem.guildId},await parseRssItem(i,arg,rssItem.author,Object.assign({},...rssJsonArray)))
            await ctx.database.set(('rssOwl' as any ),{id:rssItem.id},{lastPubDate:+new Date(i.pubDate)})
          }); 
        }
      } catch (error) {
        debug(`更新失败:${JSON.stringify(rssItem) }`)
        debug(error)
      }
    }
  }

  async function sendMessageToChannel(ctx, guild, broadMessage) {
    const targetChannels = await ctx.database.get("channel", guild);
    debug("sendMessageToChannel")
    debug(guild)
    debug(targetChannels)
    if (targetChannels.length === 1) {
        const bot = ctx.bots.find((bot) => bot.userId === targetChannels[0].assignee);
        if (bot) {
            await bot.sendMessage(guild.guildId, broadMessage);
        } else {
            throw new Error("指定的bot未找到。");
        }
    } else if (targetChannels.length > 1) {
        throw new Error("有复数个bot存在于该群组/频道，请移除多余bot。");
    } else {
        throw new Error("未找到目标群组/频道。");
    }
}
// const __dirname = './cache'
const getImageUrl = async(url,arg)=>{
  let res = await $http(url,arg,{responseType: 'arraybuffer'})
  let prefix = `data:${res.headers["content-type"]};base64,`
  if(config.imageMode=='base64'){
    return h.image(Buffer.from(res.data, 'binary'),res.headers["content-type"])
  }else if(config.imageMode=='localFile'){
    let img = Buffer.from(res.data, 'binary').toString('base64')
    let fileUrl = await writeCacheFile(`${prefix}${img}`)
    return fileUrl
  }
  // let res = await $http(url,arg,{responseType: 'blob'})
  // let file = new File([res.data], "name");
}
const cacheDir = __dirname+'/cache'
const puppeteerToFile = async(puppeteer:string)=>{
  let base64 = /(?<=src=").+?(?=")/.exec(puppeteer)[0]
  const buffer = Buffer.from(base64.substring(base64.indexOf(',') + 1),'base64');
  // console.log("Byte length: " + buffer.length);
  const MB = buffer.length / 1e+6
  debug("MB: " + MB);
  return `<${MB<5?'img':'file'} src="${await writeCacheFile(base64)}"/>`
}
const writeCacheFile = async(fileUrl:string)=>{
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
  }
  let fileList = fs.readdirSync(cacheDir)
  let suffix = /(?<=^data:.+?\/).+?(?=;base64)/.exec(fileUrl)[0]
  let fileName = `${parseInt((Math.random()*10000000).toString()).toString()}.${suffix}`
  while(fileList.find(i=>i==fileName)){
    fileName = `${parseInt((Math.random()*10000000).toString()).toString()}.${suffix}`
  }
  let base64Data = fileUrl.replace(/^data:.+?;base64,/, "");
  let path = `${cacheDir}/${fileName}`
  debug(path);
  
  fs.writeFileSync(path,base64Data,'base64')
  return pathToFileURL(path).href
}
const delCache = async()=>{
  if (fs.existsSync(cacheDir)) {
    fs.rmdirSync(cacheDir,{recursive:true})
  }
  return
}
const imageUrlToFile = async(url)=>{
  // fs.
  // pathToFileURL()
}
const $http = async (url,arg,config={})=>{
  let requestConfig = {timeout:arg.timeout*1000}
  // console.log(arg);
  debug("http")
  if(arg?.proxyAgent?.enabled){
    requestConfig['proxy'] = {
      "protocol": arg.proxyAgent.protocol,
      "host": arg.proxyAgent.host,
      "port": arg.proxyAgent.port
    }
    if(arg.proxyAgent.auth.enabled){
      requestConfig['proxy']["auth"]={
        username:arg.proxyAgent.auth.username,
        password:arg.proxyAgent.auth.password
      }
    }
  }
  if(arg.userAgent){
    requestConfig['header'] = {'User-Agent':arg.userAgent}
  }
  // debug(requestConfig);
  debug(`${url} : ${JSON.stringify({...requestConfig,...config})}`)
  let res = await axios.get(url,{...requestConfig,...config})
  // console.log(res);
  
  return res
}
const getRssData = async(url,config)=>{
  // let rssXML = await fetch(url)
  // let rssText = await rssXML.text()
  // let rssJson = x2js.xml2js(rssText)
  // console.log(rssXML);
  let res = (await $http(url,config)).data
  let rssJson = x2js.xml2js(res)
  return rssJson
}
const parseRssItem = async(item:any,arg:rssArg,authorId:string|number,sourceRssJson:any)=>{
  debug(`parseRssItem:start (${sourceRssJson.rss.channel.title})`);
  let messageItem = Object.assign({},...arg.rssItem.map(key=>({[key]:item[key.split(":")[0]]??""})))
  let message = await Promise.all(Object.keys(messageItem).map(async key=>{
    let messageKey = key.split(":")
    let itemKey = messageKey[0]
    let content:string = messageKey[1]||arg?.content
    content = (["html","default","image","text","video","proto"]).find(i=>i===content)?content:(ctx.puppeteer&&config.toHTML)?"html":"default"
    let isMerge:boolean = messageKey[2]=="merge"
    let msg:string = ""
    if(itemKey == 'description'||itemKey=='custom'){
      debug(itemKey);
      let messageArray:Array<string> = []
      let description:string = item.description?.join?item.description.join(""):item.description
      let html
      if(itemKey == 'custom'){
        description = arg.custom.replace(/{{(.+?)}}/g,i=>(/[a-zA-Z\.]+/.exec(i)[0].split(".")
          .reduce((t,v,i,a)=>(i==0?(a[0]=='rss'?sourceRssJson?.[v]:item?.[v]):t?.[v])||"","")
        ))
        html = cheerio.load(description)
      }else{
        html = cheerio.load(config?.domFrame?.replace("{{description}}",description)||description)
      }
      debug(html.xml())
      if(arg.videoRepost&&(["html","default","video"]).find(i=>i===content)){
        debug("videoRepost");
        messageArray.push(...[...html('video').map((v,i)=>i.attribs.src)].map(i=>`<video src="${i}"/>`))
      }
      if(content==='html'||(content==='custom'&&arg.toHTML)){
        debug("content:html");
        debug("puppeteer");
        if(arg.proxyAgent.enabled){
          debug("puppeteer:proxyAgent");
          await Promise.all(html('img').map(async(v,i)=>i.attribs.src = await getImageUrl(i.attribs.src,arg) )) 
        }
        html('img').attr('style', 'object-fit:scale-down;max-width:100%;')
        // debug(html.xml());
        messageArray.push(await puppeteerToFile(await ctx.puppeteer.render(html.xml())))
      }else{
        if(content=='default' || content=='text' || content==='custom'){
          debug("content:text");
          messageArray.push(html.text())
        }
        if(content=='default' || content=='image' || content==='custom'){
          debug("content:image");
          let imgBuffer = await Promise.all([...html('img').map((v,i)=>i.attribs.src)].map(async i=>await getImageUrl(i.attribs.src,arg)))
          messageArray.push(...imgBuffer.map(buffer=>`<message><author id="${authorId}"/><img src="${buffer}"/></message>`))
        }
        if(content=='proto'){
          debug("content:proto");
          messageArray.push(description)
        }
      }
      msg = messageArray.map(i=>`<message><author id="${authorId}"/>${i}</message>`).flat(Infinity).join("")
    }else{
      msg = `<message><author id="${authorId}"/>${messageItem[key]}</message>`
    }
    return isMerge?`<message forward>${msg}</message>`:msg
    // return `<message><author id="${authorId}"/>${msg}</message>`
  }))
  let msg = arg.merge?`<message forward><author id="${authorId}"/>${message.join('')}</message>`:message
  debug(`parseRssItem:end (${sourceRssJson.rss.channel.title})`);
  if(config.censor){
    return `<censor>${msg}</censor>`
  }
  return msg
}
const formatArg = (arg:string,rssItem:string='',content:string='',daily:string='')=>{
  let json = Object.assign({},...(arg?.split(',')?.map(i=>({[i.split(":")[0]]:i.split(":")[1]}))||[]))
  let booleanKey = ['firstLoad','merge',"videoRepost","toHTML"]
  json = Object.assign({},...Object.keys(json).map(key=>({[key]:(booleanKey.indexOf(key)+1)?(json[key]!='false'):json[key]})))
  if(rssItem){
    json['rssItem'] = rssItem.split(',')
  }
  if(content){
    json['content'] = content
  }
  if(daily){
    json['refresh'] = 1440
    let forceLength = daily.split("/")?.[1]
    if(forceLength){
      json.forceLength = parseInt(forceLength)
    }
  }
  if(json.refresh){
    json.refresh = json.refresh?(parseInt(json.refresh)*1000):0
    json.nextUpdataTime = json.refresh?(+new Date()+json.refresh):0
  }
  if(json.forceLength){
    json.forceLength = parseInt(json.forceLength)
  }
  if(json.proxyAgent){
    debug("formatArg:proxyAgent");
    debug(json.proxyAgent);
    
    if(json.proxyAgent=='false'||json.proxyAgent=='none'||json.proxyAgent==''){
      debug("enabled:false");
      json.proxyAgent = {enabled:false}
    }else{
      let protocol = json.proxyAgent.match(/^(http|https|socks5)(?=\/\/)/)
      let host = json.proxyAgent.match(/(?<=:\/\/)(.+?)(?=\/)/)
      let port = +json.proxyAgent.match(/(?<=\/)(\d{1,5})$/)
      let proxyAgent = {enabled:true,protocol,host,port}
      json.proxyAgent = proxyAgent
      if(json.auth){
        let username = json.auth.split("/")[0]
        let password = json.auth.split("/")[1]
        let auth = {username,password}
        json.proxyAgent.auth = auth
      }
    }
  }
  if(json.custom){
    json.custom = json.custom.replace("&nbsp;"," ")
  }
  return json
}
const mixinArg = (arg)=>({
  ...config,
  ...arg,
  rssItem:arg.rssItem||Object.keys(config.rssItem).filter(i=>config.rssItem[i]),
  videoRepost:config.videoRepost&&arg.videoRepost,
  toHTML:config.toHTML&&(arg.toHTML||true),
  proxyAgent:arg.proxyAgent?(arg.proxyAgent.enabled?arg.proxyAgent:{enabled:false}):config.proxyAgent.enabled?{...config.proxyAgent,auth:config.proxyAgent.auth.enabled?config.proxyAgent.auth:{}}:{}
})
  ctx.on('ready', async () => {
    // await ctx.broadcast([`sandbox:rdbvu1xb9nn:#`], '123')
    // await sendMessageToChannel(ctx,{platform:"sandbox:rdbvu1xb9nn",guildId:"#"},"123")
    delCache()
    feeder()
    interval = setInterval(async()=>{
      feeder()
      delCache()
    },config.refresh*1000)
  })
  ctx.on('dispose', async () => {
    clearInterval(interval)
    delCache()
  })
  ctx.guild()
    .command('rssowl <url:text>', '订阅 RSS 链接或链接组,订阅链接组时用|隔开')
    .alias('rsso')
    .usage('https://github.com/borraken/koishi-plugin-rss-owl')
    .option('list', '-l 查看订阅列表')
    .option('remove', '-r <content> [订阅id|关键字] 删除订阅')
    .option('removeAll', '全部删除订阅')
    .option('arg', '-a <content>自定义配置(https://github.com/borraken/koishi-plugin-rss-owl),额外参数[forceLength,reverse]')
    .option('rssItem', '-i <content>自定义提取,例:-i title,description:text:merge,custom')
    .option('keywordFilter', '-k <content> 添加过滤规则')
    .option('content', '-c <content> 内容提取')
    .option('title', '-t <content>自定义命名')
    .option('force', '强行写入')
    // .option('rule', '-u <ruleObject:object> 订阅规则，用于对非RSS链接的内容提取')
    // .option('updata', '立刻进行一次更新，但不会影响自定义refresh的下次更新时间')
    .option('daily', '-d <content>')
    .option('test', '-T 测试')
    .example('rssowl https://hub.slarker.me/wechat/mp/msgalbum/MzA3MDM3NjE5NQ==/1375870284640911361')
    .action(async ({ session, options }, url) => {
      debug("init")
      debug(options)
      debug(session)
      const { id:guildId } = session.event.guild as any
      const { platform } = session.event as any
      const { id :author } = session.event.user as any
      debug(`${platform}:${author}:${guildId}`)
      if(config.onlySelf?.enabled){
        let user = `${platform}:${author}`
        if(!Object.keys(config.onlySelf).find(i=>i==user)){
          return `用户 ${user} 无权限`
        }
      }
      if((platform.indexOf("sandbox")+1)&&!options.test){
        logger.error('沙盒中无法获取平台信息，RSS将被订阅但不会发送，仅首次订阅和test可用')
      }
      const rssList = await ctx.database.get(('rssOwl' as any ), {platform,guildId})
      debug(rssList)
      let rssJson
      let itemArray,item
      let optionArg = formatArg(options.arg,options.rssItem,options.content,options.daily)
      let arg = mixinArg(optionArg)
      let urlList = url?.split('|')
      if (options.test) {
        debug(`test:${url}`)
        debug({guildId,platform,author,arg,optionArg})
        if(!url)return '请输入URL'
        let rssJsonArray = await Promise.all(url.split("|")
        .map(async url =>await getRssData(url,arg)))
        let itemArray = rssJsonArray.map(i=>i.rss.channel.item)
          .flat(1)
          .sort((a,b)=>+new Date(b.pubDate)-+new Date(a.pubDate))
        debug("itemArray");
        debug(itemArray);
        let rssItemArray = itemArray.filter((v,i)=>arg.forceLength?(i<arg.forceLength):(i<1)).filter((v,i)=>arg.maxRssItem?(i<arg.maxRssItem):true)
        debug("rssItemArray");
        debug(rssItemArray);
        let messageList = await Promise.all(rssItemArray.reverse().map(async i=>await parseRssItem(i,{...arg,merge:false},author,Object.assign({},...rssJsonArray))))
        debug("mergeItem");
        debug(messageList)
        return `<message forward><author id="${author}"/>${messageList.flat(Infinity).join('')}</message>`
      }
      if (options.remove) {
        debug(`remove:${options.remove}`)
        let removeIndex = ((rssList.findIndex(i=>i.rssId===+options.remove)+1)||
        (rssList.findIndex(i=>i.url==options.remove)+1)||
        (rssList.findIndex(i=>i.url.indexOf(options.remove)+1)+1)||
        (rssList.findIndex(i=>i.title.indexOf(options.remove)+1)+1))-1
        if(removeIndex==-1){
          return `未找到${options.remove}`
        }
        let removeItem =  rssList[removeIndex]
        ctx.database.remove(('rssOwl' as any ), removeItem)
        return '取消订阅成功！'
      }
      if(options?.removeAll!=undefined){
        debug(`removeAll:${rssList.length}`)
        debug(rssList)
        let rssLength = rssList.length
        debug(await ctx.database.remove(('rssOwl' as any ), {platform,guildId})) 
        return `已删除${rssLength}条`
      }
      if (options.list) {
        debug(`list`)
        if (!rssList.length) return '未订阅任何链接。'
        return "id:标题(订阅最新一条更新时间)\n"+rssList.map(i=>`${i.rssId}:${i.title||i.url} (${new Date(i.lastPubDate).toLocaleString()})`).join('\n')
      }
      if(config.urlDeduplication&& (rssList.findIndex(i=>i.url==url)+1)){
        return '已订阅此链接。'
      }
      debug(url)
      if (!url) {
        return '未输入url'
      }
      debug("subscribe active")
      let getLastPubDate = ()=>{
        if(options.daily){
          let time = options.daily.split("/")[0].split(":")
          let date = new Date()
          date.setHours(time[0])
          time[1]&&date.setMinutes(time[1])
          return +date
        }else{
          return +new Date()
        }
      }
      const subscribe = {
        url,
        platform,
        guildId,
        author,
        rssId:(+rssList.slice(-1)?.[0]?.rssId||0)+1,
        arg:optionArg,
        title:options.title||(urlList.length>1&&`订阅组:${new Date().toLocaleString()}`)||"",
        lastPubDate:getLastPubDate()
      }
      debug(subscribe);
      if(options.force){
        await ctx.database.create(('rssOwl' as any ),subscribe)
        return '添加订阅成功'
      }
      try {
        if(urlList.length===1){
          rssJson = await getRssData(url,arg)
          itemArray = rssJson.rss.channel.item
          item = rssJson.rss.channel.item[0]
          subscribe.title = subscribe.title||rssJson.rss.channel.title
        }else{
          rssJson = await Promise.all(urlList.map(async url =>await getRssData(url,arg)))
          itemArray = rssJson.map(i=>i.rss.channel.item).flat(1).sort((a,b)=>+new Date(b.pubDate)-+new Date(a.pubDate))
          item = itemArray.sort((a,b)=>+new Date(b.pubDate)-+new Date(a.pubDate))[0]
        }
        if(!item.pubDate||optionArg.forceLength){
          return "RSS中未找到可用的pubDate，这将导致无法取得更新时间，请使用forceLength属性强制在每次更新时取得最新的订阅内容"
        }
        subscribe.lastPubDate = item.pubDate || subscribe.lastPubDate
        ctx.database.create(('rssOwl' as any ),subscribe)
        // rssOwl.push(JSON.stringify(subscribe)) 
        if(arg.firstLoad) {
          if(arg.forceLength){
            itemArray = itemArray.filter((v,i)=>i<arg.forceLength)
            let messageList = await Promise.all(itemArray.map(async()=>await parseRssItem(item,{...arg,merge:false},item.author,rssJson)))
            let message = item.arg.merge?`<message><author id="${item.author}"/>${messageList.join("")}</message>`:messageList.join("")
            return message
          }else{
            return `<message>添加订阅成功</message>${await parseRssItem(item,arg,author,rssJson)}`
          }
        }
        return '添加订阅成功'
      } catch (error) {
        return `添加失败:${error}`
      }
    })
}