import { Context, Session, Logger, Schema, MessageEncoder, h, $, clone } from 'koishi'



export const Config = Schema.object({
    basic: Schema.object({
      defaultTemplate: Schema.union(templateList).description('默认消息解析模板 <br> \`auto\` ★ 当文字长度小于`300`时使用content，否则custom<br> \`content\` ★ 可自定义的基础模板，适用于文字较少的订阅，无需puppeteer<br>\`only text\` 仅推送文字，无需puppeteer<br>\`only media\` 仅推送图片和视频，无需puppeteer<br>\`only image\` 仅推送图片，无需puppeteer<br>\`only video\` 仅推送视频，无需puppeteer<br>\`proto\` 推送原始内容，无需puppeteer<br>\`default\` ★ 内置基础puppeteer模板<br>\`only description\` 内置puppeteer模板，仅包含description内容<br>\`custom\` ★ 可自定义puppeteer模板，添加了护眼的背景色及订阅信息，见下方模板设置<br>\`link\` 特殊puppeteer模板，截图内容中首个a标签网址的页面<br>在订阅时使用自定义配置时无需only字段，例:`rsso -i text <url>`使用only text模板')
        .default('content'),
      timeout: Schema.number().description('请求数据的最长时间（秒）').default(60),
      refresh: Schema.number().description('刷新订阅源的时间间隔（秒）').default(600),
      authority: Schema.number().min(1).max(5).description('基础指令的权限等级(包括添加,删除订阅等在help中标注为*的行为)').default(1),
      advancedAuthority: Schema.number().min(1).max(5).description('高级指令的权限等级(包括跨群添加,全员提醒等在help中标注为**的行为)').default(4),
      merge: Schema.union(['不合并', '有多条更新时合并', '一直合并']).description('合并消息规则').default('有多条更新时合并'),
      maxRssItem: Schema.number().description('限制更新时的最大推送数量上限，超出上限时较早的更新会被忽略').default(10),
      firstLoad: Schema.boolean().description('首次订阅时是否发送最后的更新').default(true),
      urlDeduplication: Schema.boolean().description('同群组中不允许重复添加相同订阅').default(true),
      resendUpdataContent: Schema.union(['disable','latest','all']).description('当内容更新时再次发送').default('disable').experimental(),
      imageMode: Schema.union(['base64', 'File']).description('图片发送模式，使用File可以解决部分图片无法发送的问题，但无法在沙盒中使用').default('base64'),
      videoMode: Schema.union(['filter','href','base64', 'File']).description('视频发送模式（iframe标签内的视频无法处理）<br> \`filter\` 过滤视频，含有视频的推送将不会被发送<br> \`href\` 使用视频网络地址直接发送<br> \`base64\` 下载后以base64格式发送<br> \`File\` 下载后以文件发送').default('href'),
      margeVideo: Schema.boolean().default(false).description('以合并消息发送视频'),
      usePoster: Schema.boolean().default(false).description('加载视频封面'),
      autoSplitImage: Schema.boolean().description('垂直拆分大尺寸图片，解决部分适配器发不出长图的问题').default(true),
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
      customRemark: Schema.string().role('textarea', { rows: [3, 2] }).default(`{{description}}\n{{link}}`).description('custom模板的文字补充，以custom图片作为description再次插值'),
      // customTemplate:Schema.array(Schema.object({
      //   name: Schema.string().description('模板名称'),
      //   pptr: Schema.boolean().description('是否pptr模板'),
      //   content: Schema.string().description('模板内容').default(`{{description}}`).role('textarea'),
      //   remark: Schema.string().description('模板补充内容').default(`{{description}}`).role('textarea'),
      // })).description('自定义新模板'),
    }).description('模板设置'),
    net: Schema.object({
      proxyAgent: Schema.intersect([
        Schema.object({ enabled: Schema.boolean().default(false).description('使用代理'), }),
        Schema.union([Schema.object({
          enabled: Schema.const(true).required(),
          autoUseProxy: Schema.boolean().default(false).description('新订阅自动判断代理').experimental(),
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
      censor: Schema.boolean().description('消息审查，需要censor服务').default(false),
    }).description('消息处理'),
    // customUrlEnable:Schema.boolean().description('开发中：允许使用自定义规则对网页进行提取，用于对非RSS链接抓取').default(false).experimental(),
    debug: Schema.union(debugLevel).default(debugLevel[0]),
  })
  