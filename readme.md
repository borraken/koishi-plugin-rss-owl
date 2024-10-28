# koishi-plugin-rss-owl

[![npm](https://img.shields.io/npm/v/koishi-plugin-rss-owl?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-rss-owl)

rss-owl 是一个基于[koishi](https://koishi.chat/manual/starter/)的RSS订阅工具

## 使用方法

### 1. 基本使用
[RSSHub](https://docs.rsshub.app/zh/routes/popular)
```
//对于rsshub订阅，建议使用快速链接以方便写入订阅和随时切换rsshub实例地址
//快速链接的列表及使用方法通过 rsso -q 查询
//示例使用了-i选项以设置消息模板，你可以根据需要选择，部分模板需要puppeteer，模板说明见插件配置
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
rsso -i content https://hub.slarker.me/telegram/channel/woshadiao
rsso -i content tg:woshadiao
//telegram rvalue的生草日常
rsso -i content tg:rvalue_daily
//telegram PIXIV站每日 Top50搬运
//订阅此频道时建议在关键字过滤中添加 `互推` 以过滤频道推广信息
rsso -i content tg:pixiv_top50
//github koishi issue
rsso -i content gh:issue/koishijs/koishi
//github react releases
//官方订阅源，无法使用快速链接
//https://docs.rsshub.app/zh/routes/programming#github
https://github.com/facebook/react/releases.atom

//链接组可以将多个链接的推送合并，方便管理，订阅时最好同时提供订阅名称以方便查询
rsso -t 订阅组名称 <url>|<url>|<url>...
```
你可以在[RSSHub](https://docs.rsshub.app/zh/routes/popular)中找到需要的链接

并在[RSSHub公共实例](https://docs.rsshub.app/zh/guide/instances)中寻找替换可用的实例

当然，自己部署也是可以的

部分博客或论坛等网站也会主动提供RSS订阅链接，但本插件暂不支持旧版RSS格式

部分订阅不提供pubDate，导致无法判断，你需要使用 --daily 或refresh,forceLength 以在固定时间获取固定数量的更新，或者用 -p 随时拉取最新的更新



### 2. 参数说明

#### template
模板提供了对推送内容的展示方式
在一般情况下，content模板用于少量文字图片的订阅
而default或custom模板用于含有大量文字图片的订阅
```
rsso -i custom <url>
```

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

##### todu
- [x] 稳定使用
- [x] 快速订阅功能
- [x] 视频本地转发功能
- [x] 订阅详情查询
- [ ] auto模板
- [ ] TTS
- [ ] 对返回磁链的订阅自动下载压缩发送

## 致谢:

- [koishi-plugin-rss](https://github.com/koishijs/koishi-plugin-rss)
- [koishi-plugin-rss-discourse](https://github.com/MirrorCY/koishi-plugin-rss)
- [koishi-plugin-rss-cat](https://github.com/jexjws/koishi-plugin-rss-cat)

## 化缘
- [ifdian](https://ifdian.net/setting/plan)