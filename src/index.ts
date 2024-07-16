import { Context, Session, Logger, Schema, MessageEncoder, h } from 'koishi'
import axios from 'axios'
import type {AxiosError, AxiosInstance, AxiosResponse, AxiosRequestConfig, InternalAxiosRequestConfig} from 'axios'
import * as cheerio from 'cheerio';
import { } from 'koishi-plugin-puppeteer'
import { error } from 'console';
const X2JS = require("x2js")
const x2js = new X2JS()
const logger = new Logger('rss-owl')
export const name = 'RSS-OWL'
// export const using = ['database'] as const
export const inject = {required:["database"] ,optional: ["puppeteer","censor"]}
const HttpsProxyAgent = require('https-proxy-agent');

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
  onlySelf?: boolean
  censor?: boolean
  videoRepost?: boolean
  videoFetch?: boolean
  keywordFilter?: Array<string>
  rssItem?: object
  custom?: string
  customUrlEnable?: boolean
  quickUrl?: Object
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
  maxRssItem: Schema.number().description('限制单RSS订阅更新时的最大数量上限，超出上限时靠后的更新会被忽略，防止意外情况导致刷屏(0表示不限制)').default(10),
  urlDeduplication:Schema.boolean().description('同群组中不允许添加多条相同订阅').default(true),
  toHTML: Schema.boolean().description("渲染成网页发送，需要puppeteer服务。在 puppeteer 插件设置页面中调节转换成图片的详细设置（如图片宽度），在不启用的情况下将分开发送图片，建议开启以获得更稳定的体验").default(false),
  onlySelf: Schema.boolean().description('仅允许主人操作').default(false).experimental(),
  censor: Schema.boolean().description('消息审查，需要censor服务').default(false).experimental(),
  videoRepost: Schema.boolean().description('允许发送视频').default(false),
  videoFetch: Schema.boolean().description('视频本地转发').default(false).experimental(),
  keywordFilter: Schema.array(Schema.string()).description('关键字过滤，item中title和description中含有关键字时不会推送，不区分大小写').default(['nsfw']).experimental(),
  rssItem: Schema.dict(Boolean).description('提取item中的key和channel中的key，按顺序推送 [RSS源`<item>`中的元素](https://www.rssboard.org/rss-specification#hrelementsOfLtitemgt) 。关闭key右边的开关会使 rss-owl 忽略这个key').default({"channel.title":false,"title":false,"author":false,"pubDate":false,"link":false,"description":true,"custom":false}),
  custom:Schema.string().role('textarea').default('<div style="background:url({{rss.channel.image.url}}) ;background-size: 100%, 100%;"><div style="backdrop-filter: blur(5px) brightness(0.7) grayscale(0.1);"><div style="display: flex;align-items: center;"><img src="{{rss.channel.image.url}}" style="margin-right: 10px;" alt="" srcset="" /><div><p style="font-size: x-large;font-weight: bold;color: white;">{{rss.channel.title}}</p><p style="color: white;">{{rss.channel.description}}</p></div></div><div style="color: white;">{{description}}</div></div></div>').description('rssItem中custom的内容，根据当前配置使用puppeteer，使用插值调用rssItem中所有内容，订阅时使用`\\s`代替空格'),
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
      console.log(`${rssItem.platform}:${rssItem.guildId}`);
      if(rssItem.arg.refresh){
        if(rssItem.arg.nextUpdataTime>+new Date())continue
        let nextUpdataTime = rssItem.arg.nextUpdataTime+rssItem.arg.refresh
        await ctx.database.set(('rssOwl' as any ),{id:rssItem.id},{nextUpdataTime})
      }
      try {
        let itemArray = (await Promise.all(rssItem.url.split("|")
          .map(async url => (await getRssData(url,rssItem.arg)).rss.channel.item)))
          .flat(1)
          .sort((a,b)=>+new Date(b.pubDate)-+new Date(a.pubDate))
        let arg = mixinArg(rssItem?.arg||{})
        debug(rssItem.lastPubDate);
        debug("itemArray");
        debug(itemArray[0]);
        let rssItemArray = itemArray.filter((v,i)=>rssItem.arg.forceLength?(i<rssItem.arg.forceLength):(+new Date(v.pubDate)>rssItem.lastPubDate)).filter((v,i)=>!arg.maxRssItem||i<arg.maxRssItem)
        debug(`${JSON.stringify(rssItem)}:共${rssItemArray.length}条新信息`);
        debug(rssItemArray.map(i=>i.title));
        if(rssItem.arg.forceLength){
          debug("forceLength");
          let messageList = await Promise.all(itemArray.filter((v,i)=>i<arg.rssItem.arg.forceLength).map(async i=>await parseRssItem(i,{...arg,merge:false},rssItem.author)))
          let message = rssItem.arg.merge?`<message forward><author id="${rssItem.author}"/>${messageList.join("")}</message>`:messageList.join("")
          // ctx.broadcast([`${item.platform}:${item.guildId}`],message)
          sendMessageToChannel(ctx,{platform:rssItem.platform,guildId:rssItem.guildId},message)
          await ctx.database.set(('rssOwl' as any ),{id:rssItem.id},{lastPubDate:+new Date(itemArray?.[0]?.pubDate||0)})
        }
        if(!rssItemArray.length)continue
        if(arg.mergeItem){
          debug("mergeItem");
          let messageList = await Promise.all(rssItemArray.reverse().map(async i=>await parseRssItem(i,{...arg,merge:false},rssItem.author)))
          debug(messageList.map(i=>i.slice(0,100)))
          sendMessageToChannel(ctx,{platform:rssItem.platform,guildId:rssItem.guildId},`<message forward><author id="${rssItem.author}"/>${messageList.join('')}</message>`)
          await ctx.database.set(('rssOwl' as any ),{id:rssItem.id},{lastPubDate:+new Date(rssItemArray[0].pubDate)})
        }else{
          debug("default");
          rssItemArray.reverse().forEach(async i => {
            // ctx.broadcast([`${item.platform}:${item.guildId}`], await parseRssItem(item,arg,item.author))
            sendMessageToChannel(ctx,{platform:rssItem.platform,guildId:rssItem.guildId},await parseRssItem(i,arg,rssItem.author))
            await ctx.database.set(('rssOwl' as any ),{id:rssItem.id},{lastPubDate:+new Date(i.pubDate)})
          }); 
        }
      } catch (error) {
        logger.error(`更新失败:${JSON.stringify(rssItem) }`);
        logger.error(error);
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
const $http = async (url,arg,config={})=>{
  let requestConfig = {timeout:arg.timeout*1000}
  if(arg.proxyAgent.enabled){
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
  let res = await axios.get(url,{...requestConfig,...config})
  // console.log(res);
  
  return res.data
}
const getRssData = async(url,config)=>{
  // let rssXML = await fetch(url)
  // let rssText = await rssXML.text()
  // let rssJson = x2js.xml2js(rssText)
  // console.log(rssXML);
  let res = await $http(url,config)
  // console.log(res);
  let rssJson = x2js.xml2js(res)
  // console.log(rssJson);
  
  return rssJson
}
const parseRssItem = async(item:object,arg:rssArg,authorId:string|number)=>{
  debug("parseRssItem");
  let messageItem = Object.assign({},...arg.rssItem.map(key=>({[key]:item[key]??""})))
  let message = await Promise.all(Object.keys(messageItem).map(async key=>{
    if(key == 'description'){
      debug("description");
      let videoMessage = ''
      const html = cheerio.load(messageItem[key].join?messageItem[key].join(""):messageItem[key])
      debug("cheerio.load");
      if(arg.videoRepost&&arg?.content!=='image'&&arg?.content!=='text'){
        videoMessage = [...html('video').map((v,i)=>i.attribs.src)].map(i=>`<message><author id="${authorId}"/><video src="${i}"/></message>`).join("")
      }
      debug("videoRepost");
      // console.log(arg);
      if(!arg.content&&ctx.puppeteer&&config.toHTML){
          //puppeteer
          
          // let proxyHtml = 
          // let html = messageItem[key]
            debug("puppeteer");
          if(arg.proxyAgent.enabled){
            debug("puppeteer:proxyAgent");
            await Promise.all(html('img').map(async(v,i)=>i.attribs.src = `data:image/jpeg;base64, ${Buffer.from(await $http(i.attribs.src,arg,{responseType: 'arraybuffer'}), 'binary').toString('base64')}` )) 
            console.log(html.xml());
            return `<message><author id="${authorId}"/>${await ctx.puppeteer.render(`<html>${html.xml()}</html>`)}</message>${videoMessage}`
          }
          return `<message><author id="${authorId}"/>${await ctx.puppeteer.render(`<html>${messageItem[key]}</html>`)}</message>${videoMessage}`
      }else if(!arg.content||arg.content=='default'){
        let text = `<message><author id="${authorId}"/>${html.text()}</message>`
        // console.log(imgBuffer);
        let imgBuffer = await Promise.all([...html('img').map((v,i)=>i.attribs.src)].map(async i=>await(await $http(i,arg,{responseType: 'arraybuffer'}))))
        // console.log(imgBuffer);
        
        let imgMessage = imgBuffer.map(buffer=>`<message><author id="${authorId}"/>${h.image(buffer, 'image/png')}</message>`).join("")
        return text+imgMessage
      }else if(arg.content=='text'){
            return `<message><author id="${authorId}"/>${html.text()}</message>`
      }else if(arg.content=='image'){
        let imgBuffer = await Promise.all([...html('img').map((v,i)=>i.attribs.src)].map(async i=>await(await $http(i,arg,{responseType: 'arraybuffer'}))))
        let imgMessage = imgBuffer.map(buffer=>`<message><author id="${authorId}"/>${h.image(buffer, 'image/png')}</message>`).join("")
        return imgMessage
      }else if(arg.content=='proto'){
        return `<message><author id="${authorId}"/>${messageItem[key]}${videoMessage}</message>`
      }else{
        return `<message>无效的content参数:${arg.content}</message>`
      }
    }
    return `<message><author id="${authorId}"/>${messageItem[key]}</message>`
  }))
  return arg.merge?`<message forward><author id="${authorId}"/>${message.join('')}</message>`:message
}
const formatArg = (arg:string,rssItem:string,content:string)=>{
  let json = Object.assign({},...(arg?.split(',')?.map(i=>({[i.split(":")[0]]:i.split(":")[1]}))||[]))
  let booleanKey = ['firstLoad','merge',"videoRepost","toHTML"]
  json = Object.assign({},...Object.keys(json).map(key=>({[key]:(booleanKey.indexOf(key)+1)?(json[key]!='false'):json[key]})))
  if(rssItem){
    json['rssItem'] = rssItem.split(',')
  }
  if(content){
    json['content'] = content
  }
  if(json.refresh){
    json.refresh = json.refresh?(parseInt(json.refresh)*1000):0
    json.nextUpdataTime = json.refresh?(+new Date()+json.refresh):0
  }
  if(json.forceLength){
    json.forceLength = parseInt(json.forceLength)
  }
  if(json.proxyAgent&&json.proxyAgent.enabled===true){
    let protocol = json.proxyAgent.match(/^(http|https|socks5)(?=:\/\/)/)
    let host = json.proxyAgent.match(/(?<=:\/\/)(.*)(?=:)/)
    let port = +json.proxyAgent.match(/(?<=:)(\d{1,5})$/)
    let proxyAgent = {protocol,host,port}
    json.proxyAgent = proxyAgent
    if(json.auth&&json.auth.enabled===true){
      let username = json.auth.split(":")[0]
      let password = json.auth.split(":")[1]
      let auth = {username,password}
      json.proxyAgent.auth = auth
    }
  }
  return json
}
const mixinArg = (arg)=>({
  ...config,
  ...arg,
  rssItem:arg.rssItem||Object.keys(config.rssItem).filter(i=>config.rssItem[i]),
  videoRepost:config.videoRepost&&arg.videoRepost,
  toHTML:config.toHTML&&(arg.toHTML||true),
  proxyAgent:arg.proxyAgent?{...arg.proxyAgent,auth:arg.proxyAgent.auth.enabled?arg.proxyAgent.auth:{}}:config.proxyAgent.enabled?{...config.proxyAgent,auth:config.proxyAgent.auth.enabled?config.proxyAgent.auth:{}}:{}
})
  ctx.on('ready', async () => {
    // await ctx.broadcast([`sandbox:rdbvu1xb9nn:#`], '123')
    // await sendMessageToChannel(ctx,{platform:"sandbox:rdbvu1xb9nn",guildId:"#"},"123")
  // feeder()
  //   interval = setInterval(async()=>{
  //     feeder()
  //   },config.refresh*1000)
  })
  ctx.on('dispose', async () => {
    clearInterval(interval)
  })
  ctx.guild()
    .command('rssowl <url:text>', '订阅 RSS 链接或链接组,订阅链接组时用|隔开')
    .alias('rsso')
    .usage('注意：参数请写在最前面,不然会被当成 url 的一部分！')
    .option('list', '-l 查看订阅列表')
    .option('remove', '-r <content> [订阅id|关键字] 删除订阅')
    .option('removeAll', '全部删除')
    .option('arg', '-a <content>自定义配置(https://github.com/borraken/koishi-plugin-rss-owl),额外参数[forceLength,reverse]')
    .option('rssItem', '-i <content>自定义提取')
    .option('keywordFilter', '-k <content>自定义过滤规则')
    .option('content', '-c <content>[default|text|image|video|proto] description内容提取')
    .option('title', '-t <content>自定义命名')
    .option('force', '强行写入,不通过链接可用性验证')
    // .option('rule', '-u <ruleObject:object> 订阅规则，用于对非RSS链接的内容提取')
    // .option('updata', '立刻进行一次更新，但不会影响自定义refresh的下次更新时间')
    .option('daily', '-d <content>指定该订阅每天更新时间,效果同refresh:1440,例:-d 8:00')
    .option('test', '-T 按照规则返回最新更新，但不会订阅')
    .example('rssowl https://feeds.feedburner.com/ruanyifeng')
    .action(async ({ session, options }, url) => {
      debug("init")
      debug(options)
      debug(session)
      const { id:guildId } = session.event.guild as any
      const { platform } = session.event as any
      const { id :author } = session.event.user as any
      debug(`${platform}:${author}:${guildId}`)
      if((platform.indexOf("sandbox")+1)&&!options.test){
        logger.error('沙盒中无法获取平台信息，RSS将被订阅但不会发送，仅首次订阅和test可用')
      }
      const rssList = await ctx.database.get(('rssOwl' as any ), {platform,guildId})
      debug(rssList)
      let rssJson
      let itemArray,item
      let optionArg = formatArg(options.arg,options.rssItem,options.content)
      let arg = mixinArg(optionArg)
      let urlList = url?.split('|')
      if (options.test) {
        debug(`test:${url}`)
        debug({guildId,platform,author,arg,optionArg})
        if(!url)return '请输入URL'
        let itemArray = (await Promise.all(url.split("|")
          .map(async url => (await getRssData(url,arg)).rss.channel.item)))
          .flat(1)
          .sort((a,b)=>+new Date(b.pubDate)-+new Date(a.pubDate))
        debug("itemArray");
        debug(itemArray);
        let rssItemArray = itemArray.filter((v,i)=>arg.forceLength?(i<arg.forceLength):(i<1)).filter((v,i)=>arg.maxRssItem?(i<arg.maxRssItem):true)
        debug("rssItemArray");
        debug(rssItemArray);
        let messageList = await Promise.all(rssItemArray.reverse().map(async i=>await parseRssItem(i,{...arg,merge:false},author)))
        debug("mergeItem");
        debug(messageList)
        return `<message forward><author id="${author}"/>${messageList.join('')}</message>`
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
        // clearInterval(intervalList.find(i=>i.id==removeItem.id))
        // intervalList.splice(intervalList.findIndex(i=>i.id==removeItem.id),1)
        ctx.database.remove(('rssOwl' as any ), removeItem)
        // rss.splice(removeIndex-1, 1)
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
        return rssList.map(i=>`${i.rssId}:${i.title||i.url}`).join('\n')
      }
      if(config.urlDeduplication&& (rssList.findIndex(i=>i.url==url)+1)){
        return '已订阅此链接。'
      }
      debug(url)
      if (!url) {
        return '未输入url'
      }
      
      debug("subscribe active")
      const subscribe = {
        url,
        platform,
        guildId,
        author,
        rssId:(+rssList.slice(-1)?.[0]?.rssId||0)+1,
        arg:optionArg,
        title:options.title||(urlList.length>1&&`订阅组:${new Date().toLocaleString()}`)||"",
        lastPubDate:+new Date()
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
          itemArray = (await Promise.all(urlList.map(async url => (await getRssData(url,arg)).rss.channel.item))).flat(1).sort((a,b)=>+new Date(b.pubDate)-+new Date(a.pubDate))
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
            let messageList = await Promise.all(itemArray.map(async()=>await parseRssItem(item,{...arg,merge:false},item.author)))
            let message = item.arg.merge?`<message><author id="${item.author}"/>${messageList.join("")}</message>`:messageList.join("")
            return message
          }else{
            return `<message>添加订阅成功</message>${await parseRssItem(item,arg,author)}`
          }
        }
        return '添加订阅成功'
      } catch (error) {
        return `添加失败:${error}`
      }
    })
}