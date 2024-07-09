import { Context, Session, Logger, Schema, MessageEncoder, h } from 'koishi'
import * as cheerio from 'cheerio';
import { } from 'koishi-plugin-puppeteer'
const X2JS = require("x2js")
const x2js = new X2JS()

declare module 'koishi' {
  interface rssOwl {
    id:string|number
    url : string
    platform : string
    guildId : string
    author:string
    rssId:string
    arg:rssArg,
    title:string
    lastPubDate:number
  }
}

const logger = new Logger('rss-owl')

export const name = 'RSS-OWL'
// export const using = ['database'] as const
export const inject = {required:["database"] ,optional: ["puppeteer"]}

export interface Config {
  // timeout?: number
  refresh?: number
  userAgent?: string
  firstLoad?: boolean
  merge?: boolean
  mergeItem?: boolean
  urlDeduplication?: boolean
  // imageSafety?: boolean
  videoRepost?: boolean
  // proxyAgent?: string
  toImg?: boolean
  // useCss?: boolean
  rssItem?: object
  maxRssItem?:number
  debug?: boolean
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
  firstLoad?: boolean|never
  merge?: boolean|never
  mergeItem?: boolean|never
  content: string|never
  userAgent?: string|never
  videoRepost?: boolean|never
  toImg?: boolean|never
  // useCss?: boolean|never
  forceRead?:number
  rssItem?: Array<string>|never
}
// export const usage = ``
export const Config: Schema<Config> = Schema.object({
  // timeout: Schema.number().description('请求数据的最长时间（秒）').default(30),
  refresh: Schema.number().description('刷新订阅源的时间间隔（秒）,订阅配置内仅影响当前订阅').default(600),
  firstLoad:Schema.boolean().description('默认首次订阅时发送最后的更新，可以被订阅配置覆盖').default(true),
  merge:Schema.boolean().description('默认以合并消息发送，可以被订阅配置覆盖').default(true),
  mergeItem:Schema.boolean().description('有多条更新时合并发送，不同订阅链接间不会合并，可以被订阅配置覆盖').default(true),
  urlDeduplication:Schema.boolean().description('不允许添加多条相同订阅').default(true),
  // imageSafety: Schema.boolean().description('风险图片过滤').default(true).experimental(),
  // userAgent: Schema.string().role('link').description('默认请求的userAgent').experimental(),
  // proxyAgent: Schema.string().role('link').description('默认请求的代理地址').experimental(),
  toImg: Schema.boolean().description("使用 puppeteer 插件将description转换成图片发送。请确保 puppeteer 服务已加载。在 puppeteer 插件设置页面中调节转换成图片的详细设置（如图片宽度），可以被订阅配置覆盖 ").default(false),
  videoRepost: Schema.boolean().description('允许视频转发').default(false),
  // useCss: Schema.boolean().description('使用rss内的css进行puppeteer渲染 开发中').default(false).experimental(),
  maxRssItem: Schema.number().description('限制单个RSS链接更新时发送条数上限防止刷屏(0表示不限制)，可以被订阅配置覆盖').default(10),
  rssItem: Schema.dict(Boolean).description('会按照这里给出的 item 中的key，按顺序提取出 [RSS源`<item>`中的元素](https://www.rssboard.org/rss-specification#hrelementsOfLtitemgt) 拼装成一起（每项之间会加换行符）并推送至订阅该源的频道。 关闭key右边的开关会使 rss-owl 忽略这个key，可以被订阅配置覆盖').default({"title":true,"author":false,"pubDate":false,"link":false,"guid":false,"description":true}).description('推送单条更新时的排版'),
  debug:Schema.boolean().description('调试开关').default(false),

})
export function apply(ctx: Context, config: Config) {
  ctx.model.extend(('rssOwl' as any ),{
    id:{
      type:"integer",
      length:65535
    },
    url:"string",
    platform:"string",
    guildId:"string",
    author:"string",
    rssId:"string",
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
    const rssList = await ctx.database.get(('rssOwl' as any ),{})
    debug(rssList);
    for (const rssItem of rssList) {
      console.log(`${rssItem.platform}:${rssItem.guildId}`);
      if(rssItem.arg.refresh&&(rssItem.arg.nextUpdataTime>+new Date()))continue
      try {
        let rssJson = await getRssData(rssItem.url)
        let arg = mergeArg(rssItem?.arg||{})
        debug(rssItem.lastPubDate);
        let rssItemArray = rssJson.rss.channel.item.filter((v,i)=>rssItem.arg.forceLength?(i<rssItem.arg.forceLength):(+new Date(v.pubDate)>rssItem.lastPubDate)).sort((a,b)=>+new Date(b.pubDate)-+new Date(a.pubDate)).filter((v,i)=>!arg.maxRssItem||i<arg.maxRssItem)
        // debug(rssJson.rss.channel.item[0]);
        debug(`共${rssItemArray.length}条新信息`);
        debug(rssItemArray.map(i=>i.title));
        if(rssItem.arg.forceLength){
          let messageList = await Promise.all(rssItemArray.map(async()=>await parseRssItem(rssItem,{...arg,merge:false},rssItem.author)))
          let message = rssItem.arg.merge?`<message><author id="${rssItem.author}"/>${messageList.join("")}</message>`:messageList.join("")
          // ctx.broadcast([`${item.platform}:${item.guildId}`],message)
          sendMessageToChannel(ctx,{platform:rssItem.platform,guildId:rssItem.guildId},message)
          await ctx.database.set(('rssOwl' as any ),{id:rssItem.id},{lastPubDate:+new Date(rssItemArray.slice(-1)[0].pubDate)})
        }else{
          if(arg.mergeItem){
            let message = rssItemArray.forEach(async i => await parseRssItem(i,arg,rssItem.author)); 
            sendMessageToChannel(ctx,{platform:rssItem.platform,guildId:rssItem.guildId},`<message forward>${message.join('')}</message>`)
            await ctx.database.set(('rssOwl' as any ),{id:rssItem.id},{lastPubDate:+new Date(rssItemArray.slice(-1)[0].pubDate)})
          }else{
            rssItemArray.forEach(async i => {
              // ctx.broadcast([`${item.platform}:${item.guildId}`], await parseRssItem(item,arg,item.author))
              sendMessageToChannel(ctx,{platform:rssItem.platform,guildId:rssItem.guildId},await parseRssItem(i,arg,rssItem.author))
              await ctx.database.set(('rssOwl' as any ),{id:rssItem.id},{lastPubDate:+new Date(rssItem.pubDate)})
            }); 
          }
        }
        
        // if(rssItemArray.length){
        //   let lastPubDate = +new Date(rssJson.rss.channel.rssItem[0].pubDate)
        //   debug(`更新时间:${lastPubDate}`);
        //   await ctx.database.set(('rssOwl' as any ),{id:rssItem.id},{lastPubDate})
        // }
        if(rssItem.arg.nextUpdataTime){
          let nextUpdataTime = rssItem.arg.nextUpdataTime+rssItem.arg.refresh
          await ctx.database.set(('rssOwl' as any ),{id:rssItem.id},{nextUpdataTime})
        }
      } catch (error) {
        logger.error(`更新失败:${rssItem}`);
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
const getRssData = async(url)=>{
  let rssXML = await fetch(url)
  let rssText = await rssXML.text()
  let rssJson = x2js.xml2js(rssText)
  return rssJson
}
const parseRssItem = async(item:object,arg:rssArg,authorId:string|number,css:string|never='')=>{
  let messageItem = Object.assign({},...arg.rssItem.map(key=>({[key]:item[key]??""})))
  let message = await Promise.all(Object.keys(messageItem).map(async key=>{
    if(key == 'description'){
      let videoMessage = ''
      const html = cheerio.load(messageItem[key])
      
      if(arg.videoRepost&&arg?.content!=='image'&&arg?.content!=='text'){
        videoMessage = [...html('video').map((v,i)=>i.attribs.src)].map(i=>`<message><author id="${authorId}"/><video src="${i}"/></message>`).join("")
      }
      if(!arg.content&&ctx.puppeteer&&config.toImg){
          //puppeteer
          return `<message><author id="${authorId}"/>${await ctx.puppeteer.render(`<html>${messageItem[key]}</html>`)}</message>${videoMessage}`
      }else if(!arg.content||arg.content=='mixin'){
        let text = `<message><author id="${authorId}"/>${html.text()}</message>`
        let imgBuffer = await Promise.all([...html('img').map((v,i)=>i.attribs.src)].map(async i=>await(await fetch(i)).arrayBuffer()))
        let imgMessage = imgBuffer.map(buffer=>`<message><author id="${authorId}"/>${h.image(buffer, 'image/png')}</message>`).join("")
        return text+imgMessage
      }else if(arg.content=='text'){
            return `<message><author id="${authorId}"/>${html.text()}</message>`
      }else if(arg.content=='image'){
        let imgBuffer = await Promise.all([...html('img').map((v,i)=>i.attribs.src)].map(async i=>await(await fetch(i)).arrayBuffer()))
        let imgMessage = imgBuffer.map(buffer=>`<message><author id="${authorId}"/>${h.image(buffer, 'image/png')}</message>`).join("")
        return imgMessage
      }else if(arg.content=='none'){
        return `<message><author id="${authorId}"/>${messageItem[key]}${videoMessage}</message>`
      }else{
        return `无效的content参数:${arg.content}`
      }
    }
    return `<message><author id="${authorId}"/>${messageItem[key]}</message>`
  }))
  
  return arg.merge?`<message forward><author id="${authorId}"/>${message.join('')}</message>`:message
}
const formatArg = (arg:string,rssItem:string,content:string)=>{
  let json = Object.assign({},...(arg?.split(',')?.map(i=>({[i.split(":")[0]]:i.split(":")[1]}))||[]))
  let booleanKey = ['firstLoad','merge',"videoRepost","toImg"]
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
  return json
}
const mergeArg = (arg)=>({
  ...config,
  ...arg,
  rssItem:arg.rssItem||Object.keys(config.rssItem).filter(i=>config.rssItem[i]),
  videoRepost:config.videoRepost&&arg.videoRepost,
  toImg:config.toImg&&(arg.toImg||true)
})
  ctx.on('ready', async () => {
    // await ctx.broadcast([`sandbox:rdbvu1xb9nn:#`], '123')
    // await sendMessageToChannel(ctx,{platform:"sandbox:rdbvu1xb9nn",guildId:"#"},"123")
  feeder()
    interval = setInterval(async()=>{
      feeder()
    },config.refresh*1000)
  })
  ctx.on('dispose', async () => {
    clearInterval(interval)
  })
  ctx.guild()
    .command('rssowl <url:text>', '订阅 RSS 链接')
    .alias('rsso')
    .option('list', '-l 查看订阅列表')
    .option('remove', '-r <content> [订阅id|关键字] 删除订阅')
    .option('removeAll', '全部删除，仅管理员可用')
    .option('arg', '-a <content>订阅参数,覆盖插件配置,额外参数forceLength(强制更新最新的item),例:-a refresh:1440,forceLength:10')
    .option('rssItem', '-i <content>订阅参数,覆盖插件配置,同插件配置rssItem,例:-i title,link,description')
    .option('content', '-c <content>[text|image|none] 内容提取,设为none时将对description内容直接输出')
    .option('title', '-t <content>自定义命名')
    .option('force', '强行写入，不通过链接可用性验证')
    // .option('rule', '-u <ruleObject:object> 订阅规则，用于对非RSS链接的内容提取')
    // .option('updata', '立刻进行一次更新，但不会影响自定义refresh的下次更新时间')
    // .option('time', '指定该订阅每天更新时间，效果同refresh:1440,例:--time 08:00')
    .option('test', '-T 测试用，直接返回最新更新，但不会订阅')
    .action(async ({ session, options }, url) => {
      debug("init")
      debug(options)
      debug(session)
      const { id:guildId } = session.event.guild as any
      const { platform } = session.event as any
      const { id :author } = session.event.user as any
      debug(`${platform}:${author}:${guildId}`)
      const rssList = await ctx.database.get(('rssOwl' as any ), {platform,guildId})
      debug(rssList)
      let rssJson
      let itemArray,item
      let optionArg = formatArg(options.arg,options.rssItem,options.content)
      let arg = mergeArg(optionArg)
      // return '1'
      if (options.test) {
        debug(`test:${url}`)
        debug({guildId,platform,author,arg,optionArg})
        if(!url)return '请输入URL'
        rssJson = await getRssData(url)
        itemArray = rssJson.rss.channel.item
        item = itemArray[0]
        // return await parseRssItem(item,arg,author)
        sendMessageToChannel(ctx,{guildId,platform},await parseRssItem(item,arg,author))
        return
      }
      if (options.remove) {
        debug(`remove:${options.remove}`)
        let removeIndex = ((rssList.findIndex(i=>i.rssId==options.remove)+1)||
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
        title:options.title||"",
        lastPubDate:+new Date()
      }
      debug(subscribe);
      if(options.force){
        ctx.database.create(('rssOwl' as any ),subscribe)
        return '添加订阅成功'
      }
      try {
        rssJson = await getRssData(url)
        if(!rssJson.rss.channel.item[0].pubDate||optionArg.forceLength){
          return "RSS中未找到可用的pubDate，这将导致无法取得更新时间，请使用forceLength属性强制在每次更新时取得最新的订阅内容"
        }
        subscribe.title = subscribe.title||rssJson.rss.channel.title
        subscribe.lastPubDate = rssJson?.rss?.channel?.item?.[0]?.pubDate || subscribe.lastPubDate
        ctx.database.create(('rssOwl' as any ),subscribe)
        // rssOwl.push(JSON.stringify(subscribe)) 
        if(arg.firstLoad) {
          itemArray = rssJson.rss.channel.item
          if(arg.forceLength){
            itemArray = itemArray.filter((v,i)=>i<arg.forceLength)
            let messageList = await Promise.all(itemArray.map(async()=>await parseRssItem(item,{...arg,merge:false},item.author)))
            let message = item.arg.merge?`<message><author id="${item.author}"/>${messageList.join("")}</message>`:messageList.join("")
            return message
          }else{
            return `<message>添加订阅成功</message>${await parseRssItem(itemArray[0],arg,author)}`
          }
        }
        return '添加订阅成功'
      } catch (error) {
        return `添加失败:${error}`
      }
    })
}