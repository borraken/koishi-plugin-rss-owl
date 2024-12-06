# koishi-plugin-rss-owl

[![npm](https://img.shields.io/npm/v/koishi-plugin-rss-owl?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-rss-owl)

rss-owl 是一个基于[koishi](https://koishi.chat/manual/starter/)的RSS订阅工具

## 使用方法

### 1. 基本使用
[RSSHub](https://docs.rsshub.app/zh/routes/popular)上有非常多的订阅可供使用

对于RSSHub上面的订阅，建议使用快速链接进行订阅，见[快速链接说明](#4-快速链接说明)

示例使用了`-i`选项以设置消息模板，你可以根据需要切换，见[消息模板说明](#5-消息模板说明)
```
//每天60s早报
rsso -i default https://hub.slarker.me/qqorw
rsso -i default rss:qqorw
//微信公众号话题tag 看理想|李想主义 
rsso -i custom mp-tag:MzA3MDM3NjE5NQ==/1375870284640911361
//豆瓣小组-可爱事物分享
rsso rss:douban/group/648102
//阮一峰的网络日志
rsso -i custom https://www.ruanyifeng.com/blog/atom.xml

//以下链接可能需要配置proxy才能显示完整内容
//telegram每日沙雕墙
//rsshub的tg频道订阅中不会收录被标记为NSFW的内容
//订阅每日沙雕墙频道时建议在关键字过滤中添加 `nsfw` 以过滤掉NSFW提前警告信息
rsso -i content tg:woshadiao
//telegram rvalue的生草日常
rsso -i content tg:rvalue_daily
//telegram PIXIV站每日 Top50搬运
//订阅此频道时建议在关键字过滤中添加 `互推` 以过滤频道推广信息
rsso -i content tg:pixiv_top50
//github koishi issue
rsso -i content gh:issue/koishijs/koishi
//github react releases（官方订阅源，无法使用快速链接，说明见 https://docs.rsshub.app/zh/routes/programming#github）
rsso https://github.com/facebook/react/releases.atom

//链接组可以将多个链接的推送合并，方便管理，订阅时最好同时提供订阅名称以方便查询
rsso -t 订阅组名称 <url>|<url>|<url>...
```

部分博客或论坛等网站也会主动提供RSS订阅链接，但部分格式的RSS链接可能因解析错误无法订阅

如果在订阅时出现报错等情况，请在确认链接能够正常打开并返回xml文本后提交issue

部分订阅不提供pubDate，导致插件无法判断更新时间，你需要使用`--daily` 或`--arg refresh,forceLength` 以在固定时间获取固定数量的更新，或者用 `-p` 随时拉取最新的更新



### 2. 参数说明

#### 订阅id/关键字
部分功能选项,如follow/remove,需要使用订阅id或关键字进行选择,在使用此类功能时，将按顺序匹配 订阅id，url，标题

订阅id，即通过`rsso -l`查询得到的id，此id仅在当前群有效

关键字，以早报网为例，`rsso -l qqorw`/`rsso -l 早报网`都可以匹配到

当没有重名订阅时，`早报`甚至`rsso -l 早`都可以正确匹配

#### follow/follow-all

当群聊比较活跃时，你可能会错过一些信息

这时候，通过`rsso -f <订阅id|关键字>`来关注此订阅，如`rsso -f 早报`

关注后，当此订阅更新时，bot会 @你 ，然后你就可以快速跳转啦

需要取消关注，只需再次发送`rsso -f <订阅id|关键字>`即可

如果你希望在此订阅更新时 `@全体成员` ，可通过follow-all选项添加关注，同样的，再次发送时将取消

follow-all需要高级指令权限，修改权限见下方权限说明

此功能可能会造成不必要的打扰，请谨慎使用

#### arg
arg 可以写入局部参数，这会在使用该订阅时覆盖掉插件配置而不会影响其他订阅

支持的参数有[merge|forceLength|reverse|timeout|refresh|maxRssItem|firstLoad|bodyWidth|bodyPadding|proxyAgent|auth]

```
// 强制使用合并消息（false为强制不使用）
rsso -a merge:true <url>
// 关闭代理
rsso -a proxyAgent:false <url>
//添加代理
rsso -a proxyAgent:http//127.0.0.1/7890,auth:username/password <url>
//forceLength和refresh的组合可以让你订阅一些不提供更新时间的订阅，如排行榜
//发送最新10条消息，每日更新1次
rsso -a forceLength:10,refresh:1440 <url>
```

#### daily
指定该订阅每天更新时间和更新条数
```
//每日早8点推送10条最新内容
rsso -d 8:00/10 <url>
//每日早10点推送1条最新内容
rsso -d 10:00 <url>
```

#### pull
例：`rsso -p 早报网`

立刻拉取此订阅的最新更新

此拉取不会修改数据库，如果你先于刷新时拉取，刷新时将再次推送此订阅

#### test
例：`rsso -T url`

测试链接可用性，返回最新更新内容

可以通过此选项测试不同模板的表现差异


### 3. 插值说明

`{{插值1|插值2|插值3...|'缺省'}}`

如果插值1未找到,则往后查询,也可以用''单引号插入文字作为缺省值

atom格式的订阅同样会被转成rss订阅的变量进行插值，但部分变量有可能未转换或不全

你可以提交issue，或者在配置最下方选择`debug：detail`，保存配置后重新订阅，并log中搜索`atom item`通过插值手动展示

|插值变量名(写入{{}}中)|说明（不含*的条目有可能不被提供）|内容|
|--|--|--|
|item元素可以直接用变量名|||
|title|标题*|10月29日，星期二，在这里每天60秒读懂世界！|
|description|内容*|--|
|link|链接*|https://www.qqorw.cn/mrzb/657.html|
|guid|唯一标识符|https://www.qqorw.cn/mrzb/657.html|
|pubDate|更新时间（不等于RSS源的收录时间）|Tue, 29 Oct 2024 00:50:29 GMT|
|author|作者|早报网|
|category|类别|每日早报|
|channel元素需要加上前缀|||
|rss.channel.title|频道标题*|早报网|
|rss.channel.link|频道链接*|https://qqorw.cn/|
|rss.channel.description|频道描述*|每天更新15条简语早报和一条微语，国际早报，财经早报，早报软件，每天60秒足不出户了解天下事！ - Powered by RSSHub|
|rss.channel.generator|用于生成 feed 的程序|RSSHub|
|rss.channel.webMaster|此 feed 的 web 管理员的电子邮件地址|contact@rsshub.app (RSSHub)|
|rss.channel.language|--|zh-cn|
|rss.channel.image.url|频道图像地址|https://qqorw.cn/static/upload/2022/07/22/202207227737.png|
|rss.channel.image.title|--|早报网|
|rss.channel.image.link|--|https://qqorw.cn|
|arg元素与RSS协议无关，是插件内部记录订阅信息的元素|使用中的插件配置项也在其中|可以通过数据库插件查询|
|arg.title|订阅标题||
|arg.url|订阅链接||
|arg.author|订阅用户的id||
|arg.rssId|订阅id||
|arg.template|订阅模板||
|arg.proxyAgent.host|代理地址||

### 4. 快速链接说明

对于rsshub订阅，可使用快速链接以方便写入订阅和随时切换rsshub实例 [RSSHub公共实例](https://docs.rsshub.app/zh/guide/instances)

切换实例地址，在插件配置中 消息处理>msg.rssHubUrl

快速链接的列表通过`rsso -q`查询

写入链接后可通过`rsso -l`查询当前真实订阅地址
```
//以下两条链接对应的真实地址是一样的
https://<RSSHub实例地址>/<Route1>/<Route2>/...
rss:<Route1>/<Route2>/...

//在初始配置下，以下两条链接对应的真实地址是完全相同的
rsso https://hub.slarker.me/qqorw
rsso rss:qqorw

//这是tg频道的订阅，非常的方便
rsso https://hub.slarker.me/telegram/channel/woshadiao
rsso tg:woshadiao
```
如果有其他比较常用的路由想要加入快速链接，也欢迎提交issue

### 5. 消息模板说明

`content` ★ 可自定义的基础模板，可以完全展示所有内容，但容易刷屏

`text` 仅推送文字的模板

`media` 仅推送图片和视频

`image` 仅推送图片

`video` 仅推送视频

`proto` 推送不经处理的description原始内容
***
以下模板需要启用puppeteer插件才能正常使用
***
`default` ★ 最基础的pptr模板

`description` 仅包含description内容的pptr模板

`custom` ★ 高度可定制化的pptr模板，默认添加了护眼背景色及订阅信息

`link` 特殊模板，通过pptr对description内容中首个a标签网址访问并截图
***
例:`rsso -i text <url>`使用text模板订阅

### 6. 权限说明

仅bot主人可更改权限，普通用户请联系此bot的主人

本插件使用了koishi内置的[权限系统](https://koishi.chat/zh-CN/api/service/permissions.html)

但是目前这文档完全摸不着头脑，别看

看这个 ->[怎么提升自己的权限（提权）](https://forum.koishi.xyz/t/topic/2034)<-

简单来说，安装并启用`change-auth-callme`插件，发送`changeauth 5`

或使用`auth`插件，进行帐号绑定

提权完成后，权限会存入数据库，这时候就可以把插件关掉/卸载了

koishi所有用户默认的权限都为1，你也可以将权限限制设为1以使用功能（不推荐）

##### todu
- [x] 稳定使用
- [x] 快速订阅功能
- [x] 视频本地转发功能
- [x] 订阅详情查询
- [ ] auto模板
- [ ] TTS
- [ ] 按url合并请求
- [ ] 对返回磁链的订阅自动下载压缩发送

## 致谢:

- [koishi-plugin-rss](https://github.com/koishijs/koishi-plugin-rss)
- [koishi-plugin-rss-discourse](https://github.com/MirrorCY/koishi-plugin-rss)
- [koishi-plugin-rss-cat](https://github.com/jexjws/koishi-plugin-rss-cat)

## 化缘
- [ifdian](https://ifdian.net/a/toukoT)

